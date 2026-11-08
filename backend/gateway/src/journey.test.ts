import { createApp as createAuthApp } from '@gilder/auth/app';
import { googleSignInNotSetUp } from '@gilder/auth/firebase';
import {
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  type RunningService,
  startService,
} from '@gilder/shared';
import {
  createTestRedis,
  startTestMongo,
  type TestMongo,
  type TestRedis,
} from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

// The real gateway in front of the real auth service, each on its own port, as they run in
// development: real Redis sessions, a real MongoDB, real internal tokens.
const logger = createLogger({ service: 'journey', level: 'silent' });
const ORIGIN = 'http://localhost:3000';
let mongo: TestMongo;
let store: TestRedis;
let auth: RunningService;
let gateway: ReturnType<typeof createApp>;

beforeAll(async () => {
  mongo = await startTestMongo();
  store = await createTestRedis();
  const pair = await generateInternalKeyPair();
  const authApp = createAuthApp({
    logger,
    internalPublicKey: await importInternalPublicKey(pair.publicKey),
    redis: store.redis,
    verifyIdToken: googleSignInNotSetUp,
    devLogin: true,
    secureCookie: false,
  });
  auth = await startService(authApp, { port: 0, logger, handleSignals: false });
  const authUrl = `http://localhost:${auth.port}`;
  gateway = createApp({
    logger,
    redis: store.redis,
    privateKey: await importInternalPrivateKey(pair.privateKey),
    serviceUrls: { auth: authUrl, chat: authUrl, agent: authUrl, billing: authUrl },
    allowedOrigins: [ORIGIN],
    trustProxyHops: 1,
  });
}, 120_000);

afterAll(async () => {
  await auth.close();
  await store.cleanup();
  await mongo.stop();
});

/** The session cookie the response sets, ready to send back. */
function cookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((value) => value.startsWith('gilder_sid='))?.split(';')[0];
  if (!cookie) {
    throw new Error('no session cookie was set');
  }
  return cookie;
}

describe('sign-in journey through the gateway', () => {
  it('signs in, reads and changes the profile, logs out, and the old cookie stops working (SEC-06)', async () => {
    const signIn = await request(gateway)
      .post('/api/auth/dev-session')
      .set('Origin', ORIGIN)
      .send({ email: 'journey@example.com', name: 'Journey' });
    expect(signIn.status).toBe(200);
    const cookie = cookieFrom(signIn);

    const me = await request(gateway).get('/api/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: 'journey@example.com', name: 'Journey' });

    const theme = await request(gateway)
      .patch('/api/me')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ themePreference: 'dark' });
    expect(theme.body.user.themePreference).toBe('dark');

    const logout = await request(gateway)
      .delete('/api/auth/session')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toMatch(/^gilder_sid=;/);

    const afterLogout = await request(gateway).get('/api/me').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
  });

  it("keeps auth's internal routes out of reach (SEC-01)", async () => {
    const signIn = await request(gateway)
      .post('/api/auth/dev-session')
      .set('Origin', ORIGIN)
      .send({ email: 'reach@example.com' });
    const cookie = cookieFrom(signIn);
    const userId = signIn.body.user.id as string;

    for (const path of [
      `/api/internal/users/${userId}`,
      `/internal/users/${userId}`,
      '/sessions/dev',
    ]) {
      const response = await request(gateway).get(path).set('Cookie', cookie);
      expect(response.status, path).toBe(404);
    }
  });

  it('refuses a direct call to auth that skips the gateway (SEC-02)', async () => {
    const direct = await request(`http://localhost:${auth.port}`).get('/me');
    const directSignIn = await request(`http://localhost:${auth.port}`)
      .post('/sessions/dev')
      .send({ email: 'sneaky@example.com' });

    expect(direct.status).toBe(401);
    expect(directSignIn.status).toBe(401);
  });

  it("answers the gateway's own 401 for a missing session, before reaching auth", async () => {
    const response = await request(gateway).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body.detail).toBe('Sign in first');
  });
});

import { createApp as createAuthApp } from '@gilder/auth/app';
import { billingSignupGrant } from '@gilder/auth/billing';
import { googleSignInNotSetUp } from '@gilder/auth/firebase';
import { createApp as createBillingApp } from '@gilder/billing/app';
import { createApp as createChatApp } from '@gilder/chat/app';
import {
  createInternalClient,
  createLogger,
  SIGNUP_CREDITS,
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

// The real gateway in front of the real auth, chat and billing services, each on its own port, as
// they run in development: real Redis sessions, a real MongoDB replica set, real internal tokens,
// and auth calling billing with its own key.
const logger = createLogger({ service: 'journey', level: 'silent' });
const ORIGIN = 'http://localhost:3000';
let mongo: TestMongo;
let store: TestRedis;
let auth: RunningService;
let chat: RunningService;
let billing: RunningService;
let gateway: ReturnType<typeof createApp>;

beforeAll(async () => {
  mongo = await startTestMongo({ replicaSet: true });
  store = await createTestRedis();
  const pair = await generateInternalKeyPair();
  const authPair = await generateInternalKeyPair();
  const billingApp = createBillingApp({
    logger,
    internalPublicKey: await importInternalPublicKey(pair.publicKey),
    callerKeys: { auth: await importInternalPublicKey(authPair.publicKey) },
  });
  billing = await startService(billingApp, { port: 0, logger, handleSignals: false });
  const billingUrl = `http://localhost:${billing.port}`;
  const authApp = createAuthApp({
    logger,
    internalPublicKey: await importInternalPublicKey(pair.publicKey),
    redis: store.redis,
    verifyIdToken: googleSignInNotSetUp,
    devLogin: true,
    secureCookie: false,
    grantSignupCredits: billingSignupGrant(
      createInternalClient({
        caller: 'auth',
        privateKey: await importInternalPrivateKey(authPair.privateKey),
        service: 'billing',
        baseUrl: billingUrl,
      }),
    ),
  });
  auth = await startService(authApp, { port: 0, logger, handleSignals: false });
  const authUrl = `http://localhost:${auth.port}`;
  const chatApp = createChatApp({
    logger,
    internalPublicKey: await importInternalPublicKey(pair.publicKey),
  });
  chat = await startService(chatApp, { port: 0, logger, handleSignals: false });
  const chatUrl = `http://localhost:${chat.port}`;
  gateway = createApp({
    logger,
    redis: store.redis,
    privateKey: await importInternalPrivateKey(pair.privateKey),
    serviceUrls: { auth: authUrl, chat: chatUrl, agent: authUrl, billing: billingUrl },
    allowedOrigins: [ORIGIN],
    trustProxyHops: 1,
  });
}, 120_000);

afterAll(async () => {
  await billing.close();
  await chat.close();
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

describe('chats through the gateway', () => {
  async function signIn(email: string): Promise<string> {
    const response = await request(gateway)
      .post('/api/auth/dev-session')
      .set('Origin', ORIGIN)
      .send({ email });
    return cookieFrom(response);
  }

  it('creates, lists, renames, pins and deletes a chat for the signed-in user', async () => {
    const cookie = await signIn('chats@example.com');
    const send = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
      request(gateway)[method](path).set('Cookie', cookie).set('Origin', ORIGIN);

    const created = await send('post', '/api/chats').send({});
    expect(created.status).toBe(201);
    const id = created.body.chat.id as string;

    expect((await send('patch', `/api/chats/${id}`).send({ title: 'Goa' })).body.chat.title).toBe(
      'Goa',
    );
    expect((await send('patch', `/api/chats/${id}`).send({ pinned: true })).body.chat.pinned).toBe(
      true,
    );
    const listed = await send('get', '/api/chats?query=goa');
    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([id]);
    expect((await send('get', `/api/chats/${id}/messages`)).body.items).toEqual([]);

    expect((await send('delete', `/api/chats/${id}`)).status).toBe(204);
    expect((await send('get', `/api/chats/${id}`)).status).toBe(404);
  });

  it("gives another user a 404 for every route on someone else's chat (SEC-04)", async () => {
    const owner = await signIn('owner@example.com');
    const intruder = await signIn('intruder@example.com');
    const created = await request(gateway)
      .post('/api/chats')
      .set('Cookie', owner)
      .set('Origin', ORIGIN)
      .send({ title: 'Private plans' });
    const id = created.body.chat.id as string;

    const attempts = [
      request(gateway).get(`/api/chats/${id}`),
      request(gateway).get(`/api/chats/${id}/messages`),
      request(gateway).patch(`/api/chats/${id}`).send({ title: 'Mine' }),
      request(gateway).delete(`/api/chats/${id}`),
    ];
    for (const attempt of attempts) {
      const response = await attempt.set('Cookie', intruder).set('Origin', ORIGIN);
      expect(response.status).toBe(404);
    }
    const theirList = await request(gateway).get('/api/chats').set('Cookie', intruder);
    expect(theirList.body.items).toEqual([]);

    const stillThere = await request(gateway).get(`/api/chats/${id}`).set('Cookie', owner);
    expect(stillThere.body.chat.title).toBe('Private plans');
  });

  it("keeps chat's internal routes out of reach (SEC-01)", async () => {
    const cookie = await signIn('internal@example.com');

    for (const [method, path] of [
      ['get', '/api/internal/chats/65f0c0ffee1234567890abcd'],
      ['post', '/internal/messages'],
      ['post', '/api/internal/messages'],
    ] as const) {
      const response = await request(gateway)
        [method](path)
        .set('Cookie', cookie)
        .set('Origin', ORIGIN);
      expect(response.status, path).toBe(404);
    }
    expect((await request(`http://localhost:${chat.port}`).get('/chats')).status).toBe(401);
  });
});

describe('credits through the gateway', () => {
  it('grants the sign-up credits at the first sign-in, once, and shows the balance', async () => {
    const signIn = () =>
      request(gateway)
        .post('/api/auth/dev-session')
        .set('Origin', ORIGIN)
        .send({ email: 'credits@example.com' });

    const first = await signIn();
    await signIn();
    const account = await request(gateway)
      .get('/api/billing/account')
      .set('Cookie', cookieFrom(first));

    expect(account.status).toBe(200);
    expect(account.body).toEqual({
      account: { plan: 'free', planExpiresAt: null, balance: SIGNUP_CREDITS },
    });
  });

  it("keeps billing's internal routes out of reach (SEC-01)", async () => {
    const signIn = await request(gateway)
      .post('/api/auth/dev-session')
      .set('Origin', ORIGIN)
      .send({ email: 'free-credits@example.com' });
    const cookie = cookieFrom(signIn);

    for (const path of [
      '/api/internal/accounts',
      '/internal/credits/reserve',
      '/api/billing/internal/accounts',
    ]) {
      const response = await request(gateway)
        .post(path)
        .set('Cookie', cookie)
        .set('Origin', ORIGIN);
      expect(response.status, path).toBe(404);
    }
    // And billing itself refuses the gateway's token on them: only auth or the agent may call.
    expect(
      (await request(`http://localhost:${billing.port}`).post('/internal/accounts')).status,
    ).toBe(401);
  });
});

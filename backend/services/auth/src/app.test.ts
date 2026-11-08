import {
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  signInternalToken,
} from '@gilder/shared';
import { createTestRedis, type TestRedis } from '@gilder/shared/testing';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { googleSignInNotSetUp } from './firebase.ts';

const logger = createLogger({ service: 'auth', level: 'silent' });
let privateKey: InternalKey;
let publicKey: InternalKey;
let store: TestRedis;

beforeAll(async () => {
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
});

beforeEach(async () => {
  store = await createTestRedis();
});

afterEach(async () => {
  await store.cleanup();
});

function buildApp(devLogin = false) {
  return createApp({
    logger,
    readinessChecks: { dependency: async () => {} },
    internalPublicKey: publicKey,
    redis: store.redis,
    verifyIdToken: googleSignInNotSetUp,
    devLogin,
    secureCookie: false,
  });
}

describe('auth', () => {
  it('answers the health checks without a token', async () => {
    const health = await request(buildApp()).get('/healthz');
    const ready = await request(buildApp()).get('/readyz');

    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', service: 'auth' });
    expect(ready.body.checks).toEqual({ dependency: 'ok' });
  });

  it('answers 401 to any other direct call, and 404 for an unknown path with a token', async () => {
    const direct = await request(buildApp()).get('/me');
    const unknown = await request(buildApp())
      .get('/nothing-here')
      .set(INTERNAL_TOKEN_HEADER, await signInternalToken(privateKey, 'auth', {}));

    expect(direct.status).toBe(401);
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('not_found');
  });

  it('serves the sign-in routes, with dev sign-in only when it is on', async () => {
    const token = await signInternalToken(privateKey, 'auth', {});
    const google = await request(buildApp())
      .post('/sessions')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({ idToken: 'x' });
    const devOff = await request(buildApp(false))
      .post('/sessions/dev')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({ email: 'dev@example.com' });

    expect(google.status).toBe(503);
    expect(devOff.status).toBe(404);
  });
});

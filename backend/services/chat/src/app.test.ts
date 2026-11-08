import {
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  signInternalToken,
} from '@gilder/shared';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';

const logger = createLogger({ service: 'chat', level: 'silent' });
let privateKey: InternalKey;
let publicKey: InternalKey;
let otherPrivateKey: InternalKey;

beforeAll(async () => {
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
  otherPrivateKey = await importInternalPrivateKey((await generateInternalKeyPair()).privateKey);
});

afterEach(() => {
  vi.useRealTimers();
});

function buildApp() {
  return createApp({
    logger,
    readinessChecks: { dependency: async () => {} },
    internalPublicKey: publicKey,
  });
}

describe('chat', () => {
  it('answers the health checks without a token', async () => {
    const health = await request(buildApp()).get('/healthz');
    const ready = await request(buildApp()).get('/readyz');

    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', service: 'chat' });
    expect(ready.body.checks).toEqual({ dependency: 'ok' });
  });

  it('rejects a missing, forged, expired or misaddressed internal token (SEC-02)', async () => {
    const tokens = {
      missing: undefined,
      garbage: 'not-a-jwt',
      forged: await signInternalToken(otherPrivateKey, 'chat', { userId: 'user-1' }),
      'for another service': await signInternalToken(privateKey, 'billing', { userId: 'user-1' }),
    };

    for (const [kind, token] of Object.entries(tokens)) {
      const call = request(buildApp()).get('/anything');
      const response = await (token ? call.set(INTERNAL_TOKEN_HEADER, token) : call);
      expect(response.status, kind).toBe(401);
      expect(response.body.code, kind).toBe('unauthorized');
    }
  });

  it('rejects a token once its 60 seconds are over (SEC-02)', async () => {
    const token = await signInternalToken(privateKey, 'chat', { userId: 'user-1' });
    // Only Date is faked, so the request itself still runs on real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 120_000);

    const response = await request(buildApp()).get('/anything').set(INTERNAL_TOKEN_HEADER, token);

    expect(response.status).toBe(401);
  });

  it('lets a valid gateway token through to the routes', async () => {
    const token = await signInternalToken(privateKey, 'chat', { userId: 'user-1' });
    const response = await request(buildApp())
      .get('/nothing-here')
      .set(INTERNAL_TOKEN_HEADER, token);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('not_found');
  });
});

import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createLogger,
  createSession,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  verifyInternalToken,
} from '@gilder/shared';
import { createTestRedis, type TestRedis } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

const logger = createLogger({ service: 'gateway', level: 'silent' });
const ORIGIN = 'http://localhost:3000';
let privateKey: InternalKey;
let publicKey: InternalKey;
let store: TestRedis;

/** A stand-in for every service, which records what reaches it. */
let service: Server;
let serviceUrl: string;
let reached: { url: string; headers: IncomingHttpHeaders }[] = [];

beforeAll(async () => {
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
  service = createServer((req, res) => {
    reached.push({ url: req.url ?? '', headers: req.headers });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ reached: req.url }));
  });
  await new Promise<void>((resolve) => service.listen(0, resolve));
  serviceUrl = `http://localhost:${(service.address() as AddressInfo).port}`;
});

afterAll(async () => {
  service.closeAllConnections();
  await new Promise<void>((resolve) => service.close(() => resolve()));
});

beforeEach(async () => {
  store = await createTestRedis();
  reached = [];
});

afterEach(async () => {
  await store.cleanup();
});

function buildApp() {
  return createApp({
    logger,
    readinessChecks: { redis: async () => {} },
    redis: store.redis,
    privateKey,
    serviceUrls: { auth: serviceUrl, chat: serviceUrl, agent: serviceUrl, billing: serviceUrl },
    allowedOrigins: [ORIGIN],
    trustProxyHops: 1,
  });
}

describe('gateway', () => {
  it('answers the health checks itself', async () => {
    const health = await request(buildApp()).get('/healthz');
    const ready = await request(buildApp()).get('/readyz');

    expect(health.body).toEqual({ status: 'ok', service: 'gateway' });
    expect(ready.body.checks).toEqual({ redis: 'ok' });
    expect(reached).toEqual([]);
  });

  it('answers 404 for any path not in the route table, without reaching a service (SEC-01)', async () => {
    for (const path of [
      '/nothing-here',
      '/api/nothing',
      '/api/internal/users/1',
      '/internal/users/1',
    ]) {
      const response = await request(buildApp()).get(path);
      expect(response.status).toBe(404);
    }
    expect(reached).toEqual([]);
  });

  it('forwards an open route with a token that names no user', async () => {
    const response = await request(buildApp())
      .post('/api/auth/dev-session')
      .set('Origin', ORIGIN)
      .send({ email: 'dev@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reached: '/sessions/dev' });
    const token = String(reached[0]?.headers[INTERNAL_TOKEN_HEADER]);
    expect(await verifyInternalToken(token, { gateway: publicKey }, 'auth')).not.toHaveProperty(
      'userId',
    );
  });

  it('refuses a change from another origin before doing anything else', async () => {
    const response = await request(buildApp())
      .post('/api/auth/dev-session')
      .set('Origin', 'https://evil.example')
      .send({ email: 'dev@example.com' });

    expect(response.status).toBe(403);
    expect(reached).toEqual([]);
  });

  it('answers 401 for a route that needs a session, and forwards it with one', async () => {
    const without = await request(buildApp()).get('/api/me');
    const sessionId = await createSession(store.redis, 'user-1');
    const withSession = await request(buildApp())
      .get('/api/me')
      .set('Cookie', `gilder_sid=${sessionId}`);

    expect(without.status).toBe(401);
    expect(withSession.status).toBe(200);
    expect(reached).toHaveLength(1);
    const token = String(reached[0]?.headers[INTERNAL_TOKEN_HEADER]);
    await expect(verifyInternalToken(token, { gateway: publicKey }, 'auth')).resolves.toMatchObject(
      {
        userId: 'user-1',
      },
    );
  });
});

describe('the payment webhook', () => {
  it('reaches billing without a browser Origin, with only the signature headers added', async () => {
    const response = await request(buildApp())
      .post('/api/webhooks/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', 'abc123')
      .set('x-razorpay-event-id', 'evt_1')
      .set('x-other-header', 'dropped')
      .send('{"event":"payment.captured"}');

    expect(response.status).toBe(200);
    expect(reached[0]?.url).toBe('/webhooks/razorpay');
    expect(reached[0]?.headers['x-razorpay-signature']).toBe('abc123');
    expect(reached[0]?.headers['x-razorpay-event-id']).toBe('evt_1');
    expect(reached[0]?.headers['x-other-header']).toBeUndefined();
  });

  it('still needs the Origin on every other change, and keeps the signature headers away from it', async () => {
    const sessionId = await createSession(store.redis, 'user-1');

    const noOrigin = await request(buildApp())
      .post('/api/billing/orders')
      .set('Cookie', `gilder_sid=${sessionId}`)
      .send({ planId: 'starter' });
    const withOrigin = await request(buildApp())
      .post('/api/billing/orders')
      .set('Cookie', `gilder_sid=${sessionId}`)
      .set('Origin', ORIGIN)
      .set('x-razorpay-signature', 'sneaky')
      .send({ planId: 'starter' });

    expect(noOrigin.status).toBe(403);
    expect(withOrigin.status).toBe(200);
    expect(reached).toHaveLength(1);
    expect(reached[0]?.headers['x-razorpay-signature']).toBeUndefined();
  });
});

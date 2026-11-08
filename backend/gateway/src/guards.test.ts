import { createLogger, createService, createSession, GATEWAY_RATE_LIMITS } from '@gilder/shared';
import { createTestRedis, type TestRedis } from '@gilder/shared/testing';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ipRateLimit,
  originCheck,
  requireSession,
  sessionLookup,
  userRateLimit,
} from './guards.ts';

const logger = createLogger({ service: 'gateway', level: 'silent' });
let store: TestRedis;

beforeEach(async () => {
  store = await createTestRedis();
});

afterEach(async () => {
  await store.cleanup();
});

/** A small app that runs the given guards, then answers with who the request is for. */
function appWith(...guards: RequestHandler[]) {
  return createService({
    name: 'gateway',
    logger,
    parseJson: false,
    routes: (app) => {
      app.all('/api/echo', ...guards, (_req, res) => {
        res.json({ userId: res.locals.userId ?? null });
      });
    },
  });
}

describe('originCheck', () => {
  const app = () => appWith(originCheck(['http://localhost:3000']));

  it('lets reads through without an Origin', async () => {
    expect((await request(app()).get('/api/echo')).status).toBe(200);
  });

  it('lets a change through only from an allowed Origin', async () => {
    const allowed = await request(app()).post('/api/echo').set('Origin', 'http://localhost:3000');
    const other = await request(app()).post('/api/echo').set('Origin', 'https://evil.example');
    const missing = await request(app()).delete('/api/echo');

    expect(allowed.status).toBe(200);
    for (const response of [other, missing]) {
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('forbidden');
    }
  });
});

describe('sessionLookup and requireSession', () => {
  it("finds the cookie's session and records the user", async () => {
    const sessionId = await createSession(store.redis, 'user-1');

    const response = await request(appWith(sessionLookup(store.redis), requireSession()))
      .get('/api/echo')
      .set('Cookie', `theme=dark; gilder_sid=${sessionId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'user-1' });
  });

  it('answers 401 without a valid session, but only where one is required', async () => {
    const strict = appWith(sessionLookup(store.redis), requireSession());
    const open = appWith(sessionLookup(store.redis));

    const noCookie = await request(strict).get('/api/echo');
    const unknown = await request(strict)
      .get('/api/echo')
      .set('Cookie', `gilder_sid=${'A'.repeat(43)}`);
    const openRoute = await request(open).get('/api/echo');

    expect(noCookie.status).toBe(401);
    expect(noCookie.body.detail).toBe('Sign in first');
    expect(unknown.status).toBe(401);
    expect(openRoute.status).toBe(200);
    expect(openRoute.body).toEqual({ userId: null });
  });
});

describe('rate limits', () => {
  it('limits one IP address to the per-IP budget', async () => {
    const app = appWith(ipRateLimit(store.redis));
    const statuses: number[] = [];
    for (let i = 0; i <= GATEWAY_RATE_LIMITS.perIp; i += 1) {
      statuses.push((await request(app).get('/api/echo')).status);
    }

    expect(statuses.slice(0, GATEWAY_RATE_LIMITS.perIp).every((status) => status === 200)).toBe(
      true,
    );
    expect(statuses.at(-1)).toBe(429);
  });

  it('limits a signed-in user, and leaves signed-out requests to the IP limit', async () => {
    const sessionId = await createSession(store.redis, 'user-1');
    const app = appWith(sessionLookup(store.redis), userRateLimit(store.redis));
    const asUser = () => request(app).get('/api/echo').set('Cookie', `gilder_sid=${sessionId}`);

    for (let i = 0; i < GATEWAY_RATE_LIMITS.perUser; i += 1) {
      expect((await asUser()).status).toBe(200);
    }
    expect((await asUser()).status).toBe(429);
    expect((await request(app).get('/api/echo')).status).toBe(200);
  });
});

import { setTimeout as sleep } from 'node:timers/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger.ts';
import { hitRateLimit, rateLimit, type RateLimitRule } from './rateLimit.ts';
import { createService } from './service.ts';
import { createTestRedis, type TestRedis } from './test-redis.ts';

const logger = createLogger({ service: 'test', level: 'silent' });
const THREE_PER_MINUTE: RateLimitRule = { scope: 'ip', limit: 3 };

let store: TestRedis;

beforeEach(async () => {
  store = await createTestRedis();
});

afterEach(async () => {
  await store.cleanup();
});

describe('hitRateLimit', () => {
  it('allows requests up to the limit, then refuses them until the window ends', async () => {
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(await hitRateLimit(store.redis, THREE_PER_MINUTE, '203.0.113.7'));
    }

    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false, false]);
    expect(results.map((result) => result.remaining)).toEqual([2, 1, 0, 0, 0]);
    for (const result of results) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it('counts each caller and each scope separately', async () => {
    for (let i = 0; i < 3; i += 1) {
      await hitRateLimit(store.redis, THREE_PER_MINUTE, '203.0.113.7');
    }

    expect((await hitRateLimit(store.redis, THREE_PER_MINUTE, '203.0.113.7')).allowed).toBe(false);
    expect((await hitRateLimit(store.redis, THREE_PER_MINUTE, '198.51.100.2')).allowed).toBe(true);
    expect(
      (await hitRateLimit(store.redis, { scope: 'user', limit: 3 }, '203.0.113.7')).allowed,
    ).toBe(true);
  });

  it('starts the window with the first request, and later requests do not extend it', async () => {
    await hitRateLimit(store.redis, THREE_PER_MINUTE, 'client');
    expect(await store.redis.ttl('rl:ip:client')).toBeGreaterThan(55);

    // As if 50 of the 60 seconds had passed.
    await store.redis.expire('rl:ip:client', 10);
    const later = await hitRateLimit(store.redis, THREE_PER_MINUTE, 'client');

    expect(later.retryAfterSeconds).toBeLessThanOrEqual(10);
    expect(await store.redis.ttl('rl:ip:client')).toBeLessThanOrEqual(10);
  });

  it('starts the count over when the window ends', async () => {
    const rule: RateLimitRule = { scope: 'ip', limit: 1, windowSeconds: 1 };
    await hitRateLimit(store.redis, rule, 'client');
    expect((await hitRateLimit(store.redis, rule, 'client')).allowed).toBe(false);

    await sleep(1_100);

    expect((await hitRateLimit(store.redis, rule, 'client')).allowed).toBe(true);
  });
});

describe('rateLimit middleware', () => {
  function buildApp(keyOf: () => string | undefined) {
    return createService({
      name: 'test',
      logger,
      routes: (app) => {
        app.use(rateLimit(store.redis, { scope: 'ip', limit: 2 }, keyOf));
        app.get('/ping', (_req, res) => {
          res.json({ ok: true });
        });
      },
    });
  }

  it('answers 429 with a Retry-After header once the limit is used up', async () => {
    const app = buildApp(() => 'client');

    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await request(app).get('/ping')).status);
    }
    const refused = await request(app).get('/ping');

    expect(statuses).toEqual([200, 200, 429]);
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ code: 'rate_limited', status: 429 });
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(refused.headers['retry-after'])).toBeLessThanOrEqual(60);
  });

  it('does not count a request when there is nothing to count it against', async () => {
    const app = buildApp(() => undefined);

    for (let i = 0; i < 4; i += 1) {
      expect((await request(app).get('/ping')).status).toBe(200);
    }
    expect(await store.keys()).toEqual([]);
  });
});

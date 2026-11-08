import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  deleteSession,
  resolveSession,
  SESSION_TTL_SECONDS,
  type Session,
  sessionIdFromCookies,
} from './sessions.ts';
import { createTestRedis, type TestRedis } from './test-redis.ts';

/** The key a session ID is stored under. Written out here so the test checks the real scheme. */
function keyFor(sessionId: string): string {
  return `sess:${createHash('sha256').update(sessionId).digest('hex')}`;
}

let store: TestRedis;

beforeEach(async () => {
  store = await createTestRedis();
});

afterEach(async () => {
  await store.cleanup();
});

describe('createSession', () => {
  it('returns a new random ID each time', async () => {
    const first = await createSession(store.redis, 'user-1');
    const second = await createSession(store.redis, 'user-1');

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it('stores the session under the hash of its ID, so Redis never holds the ID itself', async () => {
    const sessionId = await createSession(store.redis, 'user-1');

    expect(await store.redis.get(keyFor(sessionId))).toBe(JSON.stringify({ userId: 'user-1' }));
    const keys = await store.keys();
    const values = await Promise.all(keys.map((key) => store.redis.get(key)));
    expect(JSON.stringify({ keys, values })).not.toContain(sessionId);
  });

  it('lets the session expire after 7 days', async () => {
    const sessionId = await createSession(store.redis, 'user-1');

    const ttl = await store.redis.ttl(keyFor(sessionId));
    expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS);
  });
});

describe('resolveSession', () => {
  it('finds the session and restarts its 7 days', async () => {
    const sessionId = await createSession(store.redis, 'user-1');
    await store.redis.expire(keyFor(sessionId), 60);

    const session: Session | undefined = await resolveSession(store.redis, sessionId);

    expect(session).toEqual({ userId: 'user-1' });
    expect(await store.redis.ttl(keyFor(sessionId))).toBeGreaterThan(SESSION_TTL_SECONDS - 5);
  });

  it('finds nothing for an unknown or malformed ID', async () => {
    for (const sessionId of ['A'.repeat(43), 'not a session id', '', 'A'.repeat(44)]) {
      expect(await resolveSession(store.redis, sessionId)).toBeUndefined();
    }
  });

  it('treats a damaged stored session as no session', async () => {
    const sessionId = 'B'.repeat(43);
    for (const stored of ['not json', '{}', JSON.stringify({ userId: '' }), '"user-1"']) {
      await store.redis.set(keyFor(sessionId), stored);
      expect(await resolveSession(store.redis, sessionId)).toBeUndefined();
    }
  });
});

describe('deleteSession', () => {
  it("ends that session and leaves the user's other sessions alone", async () => {
    const phone = await createSession(store.redis, 'user-1');
    const laptop = await createSession(store.redis, 'user-1');

    await deleteSession(store.redis, phone);

    expect(await resolveSession(store.redis, phone)).toBeUndefined();
    expect(await resolveSession(store.redis, laptop)).toEqual({ userId: 'user-1' });
  });

  it('does nothing for an ID that is unknown, already deleted or malformed', async () => {
    const sessionId = await createSession(store.redis, 'user-1');
    await deleteSession(store.redis, sessionId);

    await expect(deleteSession(store.redis, sessionId)).resolves.toBeUndefined();
    await expect(deleteSession(store.redis, 'A'.repeat(43))).resolves.toBeUndefined();
    await expect(deleteSession(store.redis, '../not-an-id')).resolves.toBeUndefined();
  });
});

describe('sessionIdFromCookies', () => {
  it('finds the session cookie among the others', () => {
    expect(sessionIdFromCookies('theme=dark; gilder_sid=abc123; other=1')).toBe('abc123');
    expect(sessionIdFromCookies('gilder_sid=abc123')).toBe('abc123');
  });

  it('finds nothing when there is no header, no session cookie or an empty one', () => {
    for (const header of [undefined, '', 'theme=dark', 'gilder_sid=', 'not a cookie header']) {
      expect(sessionIdFromCookies(header)).toBeUndefined();
    }
  });
});

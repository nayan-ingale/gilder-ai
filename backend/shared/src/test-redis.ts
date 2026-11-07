import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

/**
 * Tests use a real Redis: the local container from `pnpm infra:up`, in CI a service on the same
 * port. Database 15 keeps test keys away from the development data in database 0.
 */
const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380/15';

export interface TestRedis {
  /** A client whose keys all carry this test's own prefix. Use it like any other client. */
  redis: Redis;
  /** Every key this test has written, without the prefix. */
  keys: () => Promise<string[]>;
  /** Deletes this test's keys and closes the connection. */
  cleanup: () => Promise<void>;
}

/**
 * A Redis client for one test. ioredis adds a random prefix to every key it writes, so tests
 * running at the same time, even in other packages, never see each other's keys, and cleanup
 * deletes only this test's keys.
 */
export async function createTestRedis(): Promise<TestRedis> {
  const prefix = `test:${randomUUID()}:`;
  const redis = new Redis(TEST_REDIS_URL, {
    keyPrefix: prefix,
    lazyConnect: true,
    // Fail at once when Redis isn't running, instead of retrying until the test times out.
    retryStrategy: () => null,
  });
  try {
    await redis.connect();
  } catch (error) {
    throw new Error(`Tests need Redis at ${TEST_REDIS_URL}. Start it with \`pnpm infra:up\`.`, {
      cause: error,
    });
  }

  const keys = async (): Promise<string[]> => {
    // SCAN takes a pattern, not a key, so ioredis doesn't add the prefix to it.
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      found.push(...batch.map((key) => key.slice(prefix.length)));
      cursor = next;
    } while (cursor !== '0');
    return found;
  };

  return {
    redis,
    keys,
    cleanup: async () => {
      const written = await keys();
      if (written.length > 0) {
        await redis.del(...written);
      }
      await redis.quit();
    },
  };
}

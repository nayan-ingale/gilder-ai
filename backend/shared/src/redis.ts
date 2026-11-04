import { Redis } from 'ioredis';
import type { Logger } from './logger.ts';

export type { Redis };

/** Creates a Redis client that logs connection errors instead of crashing the app. */
export function createRedis(url: string, logger: Logger): Redis {
  const client = new Redis(url, { maxRetriesPerRequest: 2 });
  client.on('error', (error) => {
    logger.error({ err: error }, 'redis error');
  });
  return client;
}

/** Readiness check: fails unless Redis answers PING. */
export async function pingRedis(client: Redis): Promise<void> {
  const reply = await client.ping();
  if (reply !== 'PONG') {
    throw new Error(`unexpected redis ping reply: ${reply}`);
  }
}

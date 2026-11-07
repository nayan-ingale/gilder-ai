import { Redis } from 'ioredis';
import type { Logger } from './logger.ts';

export type { Redis };

/**
 * Creates a Redis client for the app.
 * - Its errors go to the app's logger, as JSON lines like every other log. Without an 'error'
 *   listener ioredis would not crash; it would print the stack with console.error instead.
 * - Commands sent while Redis is down wait in a queue, and ioredis rejects the whole queue on every
 *   third failed reconnect (maxRetriesPerRequest + 1, counted for the client, not per command).
 *   Its backoff grows to 5 s, so a command waits at most about 15 s; the default of 20 would make
 *   that about 100 s. Requests get an error instead of hanging for minutes.
 */
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

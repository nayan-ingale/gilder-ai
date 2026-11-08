import type { Logger, Redis } from '@gilder/shared';

/**
 * Stopping an answer, whichever agent instance is writing it. A running answer is registered in
 * Redis under its turn ID with its owner; a stop checks the owner, then publishes the turn ID,
 * and the instance running it aborts the provider call.
 */

const CHANNEL = 'turn-stops';
const TURN_TTL_SECONDS = 15 * 60;
const turnKey = (turnId: string) => `turn:${turnId}`;

export interface StopSignals {
  /** Registers a running answer. Returns the function that unregisters it. */
  register(
    turnId: string,
    userId: string,
    controller: AbortController,
  ): Promise<() => Promise<void>>;
  /** Stops the user's running answer. False when there is no such answer for this user. */
  stop(turnId: string, userId: string): Promise<boolean>;
  close(): Promise<void>;
}

export async function createStopSignals(redis: Redis, logger: Logger): Promise<StopSignals> {
  // A connection in subscriber mode can't run other commands, so it gets its own.
  const subscriber = redis.duplicate();
  const running = new Map<string, AbortController>();
  subscriber.on('message', (_channel: string, turnId: string) => {
    running.get(turnId)?.abort();
  });
  subscriber.on('error', (error: unknown) => {
    logger.error({ err: error }, 'redis stop-signal subscriber error');
  });
  await subscriber.subscribe(CHANNEL);

  return {
    async register(turnId, userId, controller) {
      running.set(turnId, controller);
      await redis.set(turnKey(turnId), userId, 'EX', TURN_TTL_SECONDS);
      return async () => {
        running.delete(turnId);
        await redis.del(turnKey(turnId));
      };
    },
    async stop(turnId, userId) {
      if ((await redis.get(turnKey(turnId))) !== userId) {
        return false;
      }
      await redis.publish(CHANNEL, turnId);
      return true;
    },
    async close() {
      running.clear();
      await subscriber.quit();
    },
  };
}

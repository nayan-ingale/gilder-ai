import type { Logger } from '@gilder/shared';
import { MessageModel } from './models.ts';

/**
 * How long an answer may stay "being written" before the sweeper marks it failed. Its text is
 * saved only when the agent settles the turn, so an answer still streaming after this long was
 * left behind, say because the agent stopped mid-answer. The same cutoff as billing's credit
 * holds, which no answer outlives.
 */
export const STALE_ANSWER_MS = 10 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;

export interface SweepOptions {
  olderThanMs?: number;
  now?: Date;
}

/**
 * Marks every answer still streaming past the cutoff as failed, so it can be regenerated or its
 * question edited again (both refuse an answer that is still being written). One conditional
 * update, so sweeps on several chat instances can't step on each other. Returns how many it
 * marked.
 */
export async function failStaleAnswers(options: SweepOptions = {}): Promise<number> {
  const cutoff = new Date(
    (options.now ?? new Date()).getTime() - (options.olderThanMs ?? STALE_ANSWER_MS),
  );
  const { modifiedCount } = await MessageModel.updateMany(
    { status: 'streaming', updatedAt: { $lt: cutoff } },
    { $set: { status: 'failed' } },
  );
  return modifiedCount;
}

export interface SweeperOptions {
  logger: Logger;
  intervalMs?: number;
  olderThanMs?: number;
}

/** Runs the sweep every minute, never two at once. Returns a function that stops it. */
export function startStaleAnswerSweeper(options: SweeperOptions): () => void {
  const { logger } = options;
  let running = false;

  async function sweep() {
    if (running) {
      return;
    }
    running = true;
    try {
      const failed = await failStaleAnswers({
        ...(options.olderThanMs !== undefined ? { olderThanMs: options.olderThanMs } : {}),
      });
      if (failed > 0) {
        logger.info({ failed }, 'marked answers left streaming as failed');
      }
    } catch (error) {
      logger.error({ err: error }, 'the stale answer sweep failed; it runs again shortly');
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void sweep(), options.intervalMs ?? SWEEP_EVERY_MS);
  // The sweep alone must not keep the process alive during shutdown.
  timer.unref();
  return () => clearInterval(timer);
}

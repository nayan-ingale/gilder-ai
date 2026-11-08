import type { Logger } from '@gilder/shared';
import { inTransaction, releaseHeld } from './credits.ts';
import { ReservationModel } from './models.ts';

/**
 * Gives back credits that an answer held but never committed or released, say because the agent
 * crashed mid-answer. Answers end long before this, so only abandoned holds are old enough.
 */
export const STALE_RESERVATION_MS = 10 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;
const BATCH_SIZE = 100;

export interface SweepOptions {
  olderThanMs?: number;
  now?: Date;
}

/**
 * Releases every held reservation older than the cutoff, each in its own transaction. Safe to run
 * on several billing instances at once: a reservation is released only while it is still held,
 * so each one is given back exactly once. Returns how many it released.
 */
export async function releaseStaleReservations(options: SweepOptions = {}): Promise<number> {
  const cutoff = new Date(
    (options.now ?? new Date()).getTime() - (options.olderThanMs ?? STALE_RESERVATION_MS),
  );
  let released = 0;
  for (;;) {
    const stale = await ReservationModel.find({ status: 'held', createdAt: { $lt: cutoff } })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE)
      .select({ _id: 1 });
    for (const { _id } of stale) {
      const reservation = await inTransaction((session) => releaseHeld({ _id }, session));
      if (reservation) {
        released += 1;
      }
    }
    if (stale.length < BATCH_SIZE) {
      return released;
    }
  }
}

export interface SweeperOptions {
  logger: Logger;
  intervalMs?: number;
  olderThanMs?: number;
}

/** Runs the sweep every minute, never two at once. Returns a function that stops it. */
export function startReservationSweeper(options: SweeperOptions): () => void {
  const { logger } = options;
  let running = false;

  async function sweep() {
    if (running) {
      return;
    }
    running = true;
    try {
      const released = await releaseStaleReservations({
        ...(options.olderThanMs !== undefined ? { olderThanMs: options.olderThanMs } : {}),
      });
      if (released > 0) {
        logger.info({ released }, 'released stale credit reservations');
      }
    } catch (error) {
      logger.error({ err: error }, 'the stale reservation sweep failed; it runs again shortly');
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void sweep(), options.intervalMs ?? SWEEP_EVERY_MS);
  // The sweep alone must not keep the process alive during shutdown.
  timer.unref();
  return () => clearInterval(timer);
}

import { Router } from 'express';
import type { Logger } from './logger.ts';

/** Resolves when a dependency (database, cache...) is usable, rejects otherwise. */
export type ReadinessCheck = () => Promise<void>;

const CHECK_TIMEOUT_MS = 2_000;

/**
 * /healthz: the process is up (used to restart a stuck app).
 * /readyz: every dependency answers (used to decide whether to send it traffic).
 */
export function healthRouter(
  service: string,
  checks: Record<string, ReadinessCheck>,
  logger: Logger,
): Router {
  const router = Router();

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', service });
  });

  router.get('/readyz', async (_req, res) => {
    const results: Record<string, 'ok' | 'failed'> = {};
    await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          await withTimeout(check(), CHECK_TIMEOUT_MS);
          results[name] = 'ok';
        } catch (error) {
          results[name] = 'failed';
          logger.warn({ err: error, check: name }, 'readiness check failed');
        }
      }),
    );
    const ready = Object.values(results).every((result) => result === 'ok');
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'not_ready', service, checks: results });
  });

  return router;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

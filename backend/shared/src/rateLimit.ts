import type { Request, RequestHandler, Response } from 'express';
import { AppError } from './errors.ts';
import type { Redis } from './redis.ts';

/**
 * Rate limits counted in Redis, so every copy of an app shares the same counts. Fixed windows:
 * the first request starts a window, and the count starts over when the window ends.
 */

export interface RateLimitRule {
  /** Names the limit in its Redis key, such as "ip" or "user". */
  scope: string;
  /** Requests allowed in one window. */
  limit: number;
  /** How long a window lasts. Defaults to 60 seconds. */
  windowSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the current window ends. */
  retryAfterSeconds: number;
}

/** Counts one request for `id` (an IP address, a user ID...) and says whether it is allowed. */
export async function hitRateLimit(
  redis: Redis,
  rule: RateLimitRule,
  id: string,
): Promise<RateLimitResult> {
  const { scope, limit, windowSeconds = 60 } = rule;
  const key = `rl:${scope}:${id}`;

  // One round trip, run as a unit: count the request, start the window's clock if it isn't
  // running yet (NX leaves a running clock alone), and read the time left. Because the count and
  // the clock are set together, a counter can never be left behind without an expiry.
  const replies = await redis.multi().incr(key).expire(key, windowSeconds, 'NX').ttl(key).exec();
  if (!replies) {
    throw new Error(`rate limit transaction for ${key} was aborted`);
  }
  for (const [error] of replies) {
    if (error) {
      throw error;
    }
  }
  const count = Number(replies[0]?.[1]);
  const ttl = Number(replies[2]?.[1]);

  return {
    allowed: count <= limit,
    remaining: Math.max(limit - count, 0),
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

/**
 * Express middleware: once a caller has used up the limit, answers 429 with a Retry-After header
 * until the window ends. `keyOf` picks what is counted, such as the caller's IP address or the
 * signed-in user; when it returns undefined the request is not counted.
 */
export function rateLimit(
  redis: Redis,
  rule: RateLimitRule,
  keyOf: (req: Request, res: Response) => string | undefined,
): RequestHandler {
  return async (req, res, next) => {
    const id = keyOf(req, res);
    if (id === undefined) {
      next();
      return;
    }
    const { allowed, retryAfterSeconds } = await hitRateLimit(redis, rule, id);
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      throw new AppError('rate_limited', `Too many requests. Try again in ${retryAfterSeconds}s.`);
    }
    next();
  };
}

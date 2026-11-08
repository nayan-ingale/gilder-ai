import {
  AppError,
  GATEWAY_RATE_LIMITS,
  type Redis,
  rateLimit,
  resolveSession,
  sessionIdFromCookies,
  setContextUserId,
} from '@gilder/shared';
import type { RequestHandler } from 'express';

/**
 * The checks the gateway runs before forwarding a request, cheapest first. Each is its own
 * middleware so the order is visible where the app puts them together.
 */

// Methods that only read. Everything else changes something, so it must come from the app.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cross-site request forgery defence: a request that changes something must carry an Origin
 * header from the frontend. Browsers set Origin themselves and pages can't fake it, so a form or
 * script on another site can't act with the user's cookie. The session cookie's SameSite=Lax is
 * the first line; this is the second.
 */
export function originCheck(allowedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.get('origin');
    if (!origin || !allowedOrigins.includes(origin)) {
      next(new AppError('forbidden', 'This request must come from the GilderAi app'));
      return;
    }
    next();
  };
}

/**
 * Looks up the session the cookie names and, when it is valid, records the user in
 * `res.locals.userId` and the log context. Each lookup also renews the session's 7 days. A
 * missing or expired session is not an error here: routes that need one check afterwards.
 */
export function sessionLookup(redis: Redis): RequestHandler {
  return async (req, res, next) => {
    const sessionId = sessionIdFromCookies(req.get('cookie'));
    const session = sessionId ? await resolveSession(redis, sessionId) : undefined;
    if (session) {
      res.locals.userId = session.userId;
      setContextUserId(session.userId);
    }
    next();
  };
}

/** For routes that need a signed-in user: 401 when the session lookup found none. */
export function requireSession(): RequestHandler {
  return (_req, res, next) => {
    if (!res.locals.userId) {
      next(new AppError('unauthorized', 'Sign in first'));
      return;
    }
    next();
  };
}

/** At most 120 requests a minute from one IP address, signed in or not. */
export function ipRateLimit(redis: Redis): RequestHandler {
  return rateLimit(redis, { scope: 'ip', limit: GATEWAY_RATE_LIMITS.perIp }, (req) => req.ip);
}

/** At most 60 requests a minute from one signed-in user, from any number of devices. */
export function userRateLimit(redis: Redis): RequestHandler {
  return rateLimit(
    redis,
    { scope: 'user', limit: GATEWAY_RATE_LIMITS.perUser },
    (_req, res) => res.locals.userId,
  );
}

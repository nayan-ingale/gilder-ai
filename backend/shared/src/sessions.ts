import { createHash, randomBytes } from 'node:crypto';
import { parseCookie } from 'cookie';
import type { Redis } from './redis.ts';

/**
 * Sign-in sessions, kept in Redis so any copy of any app can read them. Auth creates and deletes
 * them; the gateway looks them up on every request. The browser holds only a random session ID
 * in a cookie, and Redis stores the session under the SHA-256 hash of that ID: someone who reads
 * a Redis dump sees no IDs they could put in a cookie.
 */

/** The cookie that carries the session ID. */
export const SESSION_COOKIE = 'gilder_sid';

/** A session ends 7 days after it was last used. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** What a session stores: just whose it is. */
export interface Session {
  userId: string;
}

// 32 random bytes as base64url: 43 characters, and too many possibilities to guess.
const SESSION_ID_BYTES = 32;
const SESSION_ID_FORMAT = /^[A-Za-z0-9_-]{43}$/;

function sessionKey(sessionId: string): string {
  return `sess:${createHash('sha256').update(sessionId).digest('hex')}`;
}

/** Starts a session for the user. Returns its ID, the value of the session cookie. */
export async function createSession(redis: Redis, userId: string): Promise<string> {
  const sessionId = randomBytes(SESSION_ID_BYTES).toString('base64url');
  const session: Session = { userId };
  await redis.set(sessionKey(sessionId), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
  return sessionId;
}

/**
 * Finds the session for an ID from a cookie, and restarts its 7 days. Returns undefined when the
 * ID is malformed, unknown or expired; the cookie is the caller's input, so nothing is assumed.
 */
export async function resolveSession(
  redis: Redis,
  sessionId: string,
): Promise<Session | undefined> {
  if (!SESSION_ID_FORMAT.test(sessionId)) {
    return undefined;
  }
  // GETEX reads the session and renews its expiry in one round trip.
  const stored = await redis.getex(sessionKey(sessionId), 'EX', SESSION_TTL_SECONDS);
  return stored === null ? undefined : parseSession(stored);
}

/** The session ID in a request's Cookie header, or undefined when it carries none. */
export function sessionIdFromCookies(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const value = parseCookie(cookieHeader)[SESSION_COOKIE];
  return value === undefined || value === '' ? undefined : value;
}

/** Ends a session (logout). Does nothing if it has already gone. */
export async function deleteSession(redis: Redis, sessionId: string): Promise<void> {
  if (SESSION_ID_FORMAT.test(sessionId)) {
    await redis.del(sessionKey(sessionId));
  }
}

function parseSession(stored: string): Session | undefined {
  try {
    const value: unknown = JSON.parse(stored);
    if (
      typeof value === 'object' &&
      value !== null &&
      'userId' in value &&
      typeof value.userId === 'string' &&
      value.userId !== ''
    ) {
      return { userId: value.userId };
    }
  } catch {
    // Not JSON: treated like a missing session below.
  }
  return undefined;
}

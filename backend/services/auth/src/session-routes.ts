import {
  createSession,
  deleteSession,
  type Logger,
  type Redis,
  requireUser,
  SESSION_COOKIE,
  sessionIdFromCookies,
  setContextUserId,
  validate,
  z,
} from '@gilder/shared';
import { type CookieOptions, type Response, Router } from 'express';
import type { VerifyIdToken } from './firebase.ts';
import { findOrCreateDevUser, type SignedInUser, toProfile, upsertGoogleUser } from './users.ts';

/**
 * Sign-in and logout. Auth owns sessions: it creates them, sets the session cookie and deletes
 * them. The gateway only reads them. The gateway maps the public routes onto these paths.
 */

export interface SessionRouteDeps {
  redis: Redis;
  verifyIdToken: VerifyIdToken;
  /** Adds POST /sessions/dev. The settings check refuses it in production. */
  devLogin: boolean;
  /** Marks the cookie Secure, so browsers send it over HTTPS only. On in production. */
  secureCookie: boolean;
  logger: Logger;
}

// The browser keeps the cookie for at most 30 days. Redis ends the session sooner, after 7 days
// without use, so an active user stays signed in and an idle one is signed out.
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const googleSignInBody = z.object({ idToken: z.string().min(1).max(8_192) });
const devSignInBody = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(100).optional(),
});

export function sessionRouter(deps: SessionRouteDeps): Router {
  const router = Router();
  // HttpOnly: page scripts can't read it. SameSite=Lax: other sites' forms and scripts don't send
  // it. Path=/: every page of the app gets it.
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: deps.secureCookie,
  };

  async function startSession(res: Response, signedIn: SignedInUser, method: 'google' | 'dev') {
    const { user, created } = signedIn;
    const sessionId = await createSession(deps.redis, user.id);
    res.cookie(SESSION_COOKIE, sessionId, { ...cookieOptions, maxAge: COOKIE_MAX_AGE_MS });
    setContextUserId(user.id);
    deps.logger.info({ method, newUser: created }, 'signed in');
    res.json({ user: toProfile(user) });
  }

  // Google sign-in: exchanges a Firebase ID token for a session.
  router.post('/sessions', validate({ body: googleSignInBody }), async (req, res) => {
    const { idToken } = req.body as z.output<typeof googleSignInBody>;
    const identity = await deps.verifyIdToken(idToken);
    await startSession(res, await upsertGoogleUser(identity), 'google');
  });

  if (deps.devLogin) {
    // Dev sign-in: a session for any email, for local development and tests.
    router.post('/sessions/dev', validate({ body: devSignInBody }), async (req, res) => {
      const { email, name } = req.body as z.output<typeof devSignInBody>;
      await startSession(res, await findOrCreateDevUser(email, name), 'dev');
    });
  }

  // Logout: ends the session the cookie names and clears the cookie. Safe to call twice.
  router.delete('/sessions/current', requireUser(), async (req, res) => {
    const sessionId = sessionIdFromCookies(req.get('cookie'));
    if (sessionId) {
      await deleteSession(deps.redis, sessionId);
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    deps.logger.info('signed out');
    res.status(204).end();
  });

  return router;
}

import {
  createService,
  type InternalKey,
  type Logger,
  type ReadinessCheck,
  type Redis,
} from '@gilder/shared';
import type { Express } from 'express';
import type { GrantSignupCredits } from './billing.ts';
import type { VerifyIdToken } from './firebase.ts';
import { meRouter } from './me-routes.ts';
import { sessionRouter } from './session-routes.ts';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  /** The gateway's public key: every route except the health checks needs its token. */
  internalPublicKey: InternalKey;
  redis: Redis;
  verifyIdToken: VerifyIdToken;
  /** Turns on dev sign-in. The settings check refuses it in production. */
  devLogin: boolean;
  /** Marks the session cookie Secure. On in production. */
  secureCookie: boolean;
  /** Billing's sign-up grant, asked for on every sign-in. */
  grantSignupCredits: GrantSignupCredits;
}

/** The auth service: sign-in, logout, sessions and the user's profile. */
export function createApp(deps: AppDeps): Express {
  const { logger, readinessChecks } = deps;
  return createService({
    name: 'auth',
    logger,
    readinessChecks,
    internalAuth: { publicKey: deps.internalPublicKey, audience: 'auth' },
    routes: (app) => {
      app.use(
        sessionRouter({
          redis: deps.redis,
          verifyIdToken: deps.verifyIdToken,
          devLogin: deps.devLogin,
          secureCookie: deps.secureCookie,
          grantSignupCredits: deps.grantSignupCredits,
          logger,
        }),
      );
      app.use(meRouter());
    },
  });
}

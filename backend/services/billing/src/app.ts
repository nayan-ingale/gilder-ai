import {
  createService,
  type InternalKey,
  type Logger,
  type ReadinessCheck,
  type ServiceCaller,
} from '@gilder/shared';
import type { Express } from 'express';
import { accountRouter } from './account-routes.ts';
import { internalRouter } from './internal-routes.ts';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  /** The gateway's public key: every route except the health checks needs a valid token. */
  internalPublicKey: InternalKey;
  /** Public keys of the services that call billing directly: auth and the agent. */
  callerKeys: Partial<Record<ServiceCaller, InternalKey>>;
}

export function createApp({
  logger,
  readinessChecks,
  internalPublicKey,
  callerKeys,
}: AppDeps): Express {
  return createService({
    name: 'billing',
    logger,
    readinessChecks,
    internalAuth: { publicKey: internalPublicKey, audience: 'billing', callers: callerKeys },
    routes: (app) => {
      app.use(accountRouter());
      app.use(internalRouter());
    },
  });
}

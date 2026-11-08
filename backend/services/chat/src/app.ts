import { createService, type InternalKey, type Logger, type ReadinessCheck } from '@gilder/shared';
import type { Express } from 'express';
import { chatRouter } from './chat-routes.ts';
import { internalRouter } from './internal-routes.ts';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  /** The gateway's public key: every route except the health checks needs its token. */
  internalPublicKey: InternalKey;
}

export function createApp({ logger, readinessChecks, internalPublicKey }: AppDeps): Express {
  // Only the gateway's token gets past the health checks, so a direct call gets 401 on any path.
  return createService({
    name: 'chat',
    logger,
    readinessChecks,
    internalAuth: { publicKey: internalPublicKey, audience: 'chat' },
    routes: (app) => {
      app.use(chatRouter());
      app.use(internalRouter());
    },
  });
}

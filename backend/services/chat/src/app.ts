import { createService, type InternalKey, type Logger, type ReadinessCheck } from '@gilder/shared';

import type { Express } from 'express';
import { chatRouter } from './chat-routes.ts';
import { internalRouter } from './internal-routes.ts';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  /** The gateway's public key: every route except the health checks needs its token. */
  internalPublicKey: InternalKey;
  /** The agent's public key: only the agent may use the /internal routes. */
  agentPublicKey?: InternalKey;
}

export function createApp({
  logger,
  readinessChecks,
  internalPublicKey,
  agentPublicKey,
}: AppDeps): Express {
  // Only the gateway's token gets past the health checks, so a direct call gets 401 on any path.
  return createService({
    name: 'chat',
    logger,
    readinessChecks,
    // The agent saves whole answers, code files included, which can pass the 64 KB default.
    bodyLimit: '2mb',
    internalAuth: {
      publicKey: internalPublicKey,
      audience: 'chat',
      callers: agentPublicKey ? { agent: agentPublicKey } : {},
    },
    routes: (app) => {
      app.use(chatRouter());
      app.use(internalRouter());
    },
  });
}

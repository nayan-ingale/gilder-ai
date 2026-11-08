import { createService, type InternalKey, type Logger, type ReadinessCheck } from '@gilder/shared';
import type { Express } from 'express';
import { type TurnDeps, turnRouter } from './turns.ts';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  /** The gateway's public key: every route except the health checks needs its token. */
  internalPublicKey: InternalKey;
  /** What a turn needs: the AI, chat, billing, memory and Redis. Left out, there are no routes. */
  turns?: Omit<TurnDeps, 'logger'>;
}

/** The agent service: runs a turn (routing, credits, streaming the answer). */
export function createApp({ logger, readinessChecks, internalPublicKey, turns }: AppDeps): Express {
  return createService({
    name: 'agent',
    logger,
    readinessChecks,
    internalAuth: { publicKey: internalPublicKey, audience: 'agent' },
    routes: (app) => {
      if (turns) {
        app.use(turnRouter({ ...turns, logger }));
      }
    },
  });
}

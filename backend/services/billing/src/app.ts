import { createService, type Logger, type ReadinessCheck } from '@gilder/shared';
import type { Express } from 'express';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
}

export function createApp({ logger, readinessChecks }: AppDeps): Express {
  // No routes of its own yet: createService already serves /healthz and /readyz.
  return createService({ name: 'billing', logger, readinessChecks });
}

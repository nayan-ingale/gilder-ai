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
import { paymentRouter } from './payment-routes.ts';
import type { PaymentGateway } from './razorpay.ts';
import { usageRouter } from './usage-routes.ts';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  /** The gateway's public key: every route except the health checks needs a valid token. */
  internalPublicKey: InternalKey;
  /** Public keys of the services that call billing directly: auth and the agent. */
  callerKeys: Partial<Record<ServiceCaller, InternalKey>>;
  /** Razorpay; left out, the payment routes answer 503. */
  payments?: PaymentGateway | undefined;
}

export function createApp({
  logger,
  readinessChecks,
  internalPublicKey,
  callerKeys,
  payments,
}: AppDeps): Express {
  return createService({
    name: 'billing',
    logger,
    readinessChecks,
    internalAuth: { publicKey: internalPublicKey, audience: 'billing', callers: callerKeys },
    routes: (app) => {
      app.use(accountRouter());
      app.use(paymentRouter({ payments, logger }));
      app.use(usageRouter());
      app.use(internalRouter());
    },
  });
}

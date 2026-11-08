import {
  connectMongo,
  createLogger,
  disconnectMongo,
  importInternalPublicKey,
  pingMongo,
  startService,
} from '@gilder/shared';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { createRazorpay } from './razorpay.ts';
import { startReservationSweeper } from './sweeper.ts';

const logger = createLogger({
  service: 'billing',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

await connectMongo(env.MONGODB_URI, logger);

const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = env;
const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
const payments =
  keyId && keySecret && webhookSecret
    ? createRazorpay({ keyId, keySecret, webhookSecret })
    : undefined;
if (!payments) {
  logger.warn(
    'payments are off: set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET',
  );
}

const app = createApp({
  logger,
  readinessChecks: { mongo: pingMongo },
  internalPublicKey: await importInternalPublicKey(env.INTERNAL_PUBLIC_KEY),
  callerKeys: {
    auth: await importInternalPublicKey(env.AUTH_PUBLIC_KEY),
    agent: await importInternalPublicKey(env.AGENT_PUBLIC_KEY),
  },
  payments,
});

const stopSweeper = startReservationSweeper({ logger });

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    stopSweeper();
    await disconnectMongo();
  },
});

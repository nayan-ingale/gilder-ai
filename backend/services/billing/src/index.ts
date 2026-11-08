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
import { startReservationSweeper } from './sweeper.ts';

const logger = createLogger({
  service: 'billing',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

await connectMongo(env.MONGODB_URI, logger);

const app = createApp({
  logger,
  readinessChecks: { mongo: pingMongo },
  internalPublicKey: await importInternalPublicKey(env.INTERNAL_PUBLIC_KEY),
  callerKeys: {
    auth: await importInternalPublicKey(env.AUTH_PUBLIC_KEY),
    agent: await importInternalPublicKey(env.AGENT_PUBLIC_KEY),
  },
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

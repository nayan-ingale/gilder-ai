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
});

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    await disconnectMongo();
  },
});

import {
  connectMongo,
  createLogger,
  disconnectMongo,
  pingMongo,
  startService,
} from '@gilder/shared';
import { createApp } from './app.ts';
import { env } from './env.ts';

const logger = createLogger({
  service: 'chat',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

await connectMongo(env.MONGODB_URI, logger);

const app = createApp({ logger, readinessChecks: { mongo: pingMongo } });

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    await disconnectMongo();
  },
});

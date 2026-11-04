import {
  connectMongo,
  createLogger,
  createRedis,
  disconnectMongo,
  pingMongo,
  pingRedis,
  startService,
} from '@gilder/shared';
import { createApp } from './app.ts';
import { env } from './env.ts';

const logger = createLogger({
  service: 'auth',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

await connectMongo(env.MONGODB_URI, logger);
const redis = createRedis(env.REDIS_URL, logger);

const app = createApp({
  logger,
  readinessChecks: { mongo: pingMongo, redis: () => pingRedis(redis) },
});

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    await disconnectMongo();
    await redis.quit();
  },
});

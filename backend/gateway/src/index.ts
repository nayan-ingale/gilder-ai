import { createLogger, createRedis, pingRedis, startService } from '@gilder/shared';
import { createApp } from './app.ts';
import { env } from './env.ts';

const logger = createLogger({
  service: 'gateway',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

const redis = createRedis(env.REDIS_URL, logger);

const app = createApp({ logger, readinessChecks: { redis: () => pingRedis(redis) } });

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    await redis.quit();
  },
});

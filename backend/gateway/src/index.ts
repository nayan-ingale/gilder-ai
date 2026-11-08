import {
  createLogger,
  createRedis,
  importInternalPrivateKey,
  pingRedis,
  startService,
} from '@gilder/shared';
import { createApp } from './app.ts';
import { env } from './env.ts';

const logger = createLogger({
  service: 'gateway',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

const redis = createRedis(env.REDIS_URL, logger);

const app = createApp({
  logger,
  readinessChecks: { redis: () => pingRedis(redis) },
  redis,
  privateKey: await importInternalPrivateKey(env.INTERNAL_PRIVATE_KEY),
  serviceUrls: {
    auth: env.AUTH_SERVICE_URL,
    chat: env.CHAT_SERVICE_URL,
    agent: env.AGENT_SERVICE_URL,
    billing: env.BILLING_SERVICE_URL,
  },
  allowedOrigins: env.FRONTEND_ORIGIN,
  trustProxyHops: env.TRUST_PROXY_HOPS,
  rateLimits: { perIp: env.RATE_LIMIT_PER_IP, perUser: env.RATE_LIMIT_PER_USER },
});

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    await redis.quit();
  },
});

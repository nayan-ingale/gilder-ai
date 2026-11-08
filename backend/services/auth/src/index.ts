import {
  connectMongo,
  createLogger,
  createRedis,
  disconnectMongo,
  importInternalPublicKey,
  pingMongo,
  pingRedis,
  startService,
} from '@gilder/shared';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { createFirebaseVerifier, googleSignInNotSetUp } from './firebase.ts';

const logger = createLogger({
  service: 'auth',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

await connectMongo(env.MONGODB_URI, logger);
const redis = createRedis(env.REDIS_URL, logger);

// The settings check makes the three Firebase settings all or none, and required in production.
const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail } = env;
const privateKey = env.FIREBASE_PRIVATE_KEY;
const verifyIdToken =
  projectId && clientEmail && privateKey
    ? createFirebaseVerifier({ projectId, clientEmail, privateKey })
    : googleSignInNotSetUp;
if (verifyIdToken === googleSignInNotSetUp) {
  logger.warn('Google sign-in is not set up: the FIREBASE_* settings are empty');
}
if (env.AUTH_DEV_LOGIN) {
  logger.warn('dev sign-in is on: anyone who can reach auth can sign in with just an email');
}

const app = createApp({
  logger,
  readinessChecks: { mongo: pingMongo, redis: () => pingRedis(redis) },
  internalPublicKey: await importInternalPublicKey(env.INTERNAL_PUBLIC_KEY),
  redis,
  verifyIdToken,
  devLogin: env.AUTH_DEV_LOGIN,
  secureCookie: env.NODE_ENV === 'production',
});

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    await disconnectMongo();
    await redis.quit();
  },
});

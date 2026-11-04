import { baseEnvSchema, loadEnv, portSchema, z } from '@gilder/shared';

/** Validated at startup: the app refuses to start if anything is missing or invalid. */
export const env = loadEnv(
  baseEnvSchema.extend({
    PORT: portSchema(8003),
    MONGODB_URI: z.string().min(1),
    REDIS_URL: z.string().min(1),
  }),
);

import { baseEnvSchema, internalPublicKeySchema, loadEnv, portSchema, z } from '@gilder/shared';

/** Validated at startup: the app refuses to start if anything is missing or invalid. */
export const env = loadEnv(
  baseEnvSchema.extend({
    PORT: portSchema(8002),
    MONGODB_URI: z.string().min(1),
    /** The gateway's public key: every route except the health checks needs its token. */
    INTERNAL_PUBLIC_KEY: internalPublicKeySchema,
    /** The agent's public key: the agent saves messages and reads chat history. */
    AGENT_PUBLIC_KEY: internalPublicKeySchema,
  }),
);

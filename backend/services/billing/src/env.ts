import { baseEnvSchema, internalPublicKeySchema, loadEnv, portSchema, z } from '@gilder/shared';

/** Validated at startup: the app refuses to start if anything is missing or invalid. */
export const env = loadEnv(
  baseEnvSchema.extend({
    PORT: portSchema(8004),
    MONGODB_URI: z.string().min(1),
    /** The gateway's public key: every route except the health checks needs a valid token. */
    INTERNAL_PUBLIC_KEY: internalPublicKeySchema,
    /** Auth's public key: auth asks for the sign-up grant. */
    AUTH_PUBLIC_KEY: internalPublicKeySchema,
    /** The agent's public key: the agent reserves, commits and releases credits. */
    AGENT_PUBLIC_KEY: internalPublicKeySchema,
  }),
);

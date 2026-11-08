import {
  baseEnvSchema,
  internalPrivateKeySchema,
  internalPublicKeySchema,
  portSchema,
  serviceUrlSchema,
  z,
} from '@gilder/shared';

/**
 * The agent's settings and the rules between them. env.ts loads them at startup; they live in
 * their own file so tests can check the rules without a real environment.
 */

/** A setting that may be left out. Empty counts as unset, as in a fresh copy of .env.example. */
const optionalSetting = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

export const agentEnvSchema = baseEnvSchema
  .extend({
    PORT: portSchema(8003),
    MONGODB_URI: z.string().min(1),
    REDIS_URL: z.string().min(1),
    /** The gateway's public key: every route except the health checks needs its token. */
    INTERNAL_PUBLIC_KEY: internalPublicKeySchema,
    /** The agent's own key, for calling chat and billing. Written by `pnpm setup:keys`. */
    SERVICE_PRIVATE_KEY: internalPrivateKeySchema,
    CHAT_SERVICE_URL: serviceUrlSchema.default('http://localhost:8002'),
    BILLING_SERVICE_URL: serviceUrlSchema.default('http://localhost:8004'),
    /** live: real AI providers. mock: canned answers, no keys needed (tests and CI). */
    LLM_MODE: z.enum(['live', 'mock']).default('mock'),
    GROQ_API_KEY: optionalSetting,
    OPENROUTER_API_KEY: optionalSetting,
    GEMINI_API_KEY: optionalSetting,
  })
  .superRefine((env, ctx) => {
    // Chat and routing run on Groq, so live mode can't work without it. The other keys only turn
    // on the agents that need them.
    if (env.LLM_MODE === 'live' && !env.GROQ_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GROQ_API_KEY'],
        message: 'is required when LLM_MODE is live (or set LLM_MODE=mock)',
      });
    }
  });

export type AgentEnv = z.output<typeof agentEnvSchema>;

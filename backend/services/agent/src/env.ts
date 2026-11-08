import { loadEnv } from '@gilder/shared';
import { agentEnvSchema } from './env-schema.ts';

/** Validated at startup: the app refuses to start if anything is missing or invalid. */
export const env = loadEnv(agentEnvSchema);

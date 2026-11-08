import { generateKeyPairSync } from 'node:crypto';
import { EnvError, loadEnv } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { agentEnvSchema } from './env-schema.ts';

const PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----';
// The agent's own signing key is parsed for real, so the test makes one.
const SERVICE_KEY = generateKeyPairSync('ed25519')
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const REQUIRED = {
  MONGODB_URI: 'mongodb://db',
  REDIS_URL: 'redis://cache',
  INTERNAL_PUBLIC_KEY: PUBLIC_KEY,
  SERVICE_PRIVATE_KEY: SERVICE_KEY,
};

function problemsFor(source: Record<string, string>): string[] {
  try {
    loadEnv(agentEnvSchema, source);
  } catch (error) {
    if (error instanceof EnvError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error('expected loadEnv to throw');
}

describe('agent settings', () => {
  it('runs in mock mode by default, with no AI keys', () => {
    const env = loadEnv(agentEnvSchema, REQUIRED);

    expect(env).toMatchObject({
      LLM_MODE: 'mock',
      PORT: 8003,
      CHAT_SERVICE_URL: 'http://localhost:8002',
      BILLING_SERVICE_URL: 'http://localhost:8004',
    });
    expect(env.GROQ_API_KEY).toBeUndefined();
  });

  it('needs a Groq key in live mode, and treats empty keys as unset', () => {
    expect(problemsFor({ ...REQUIRED, LLM_MODE: 'live', GROQ_API_KEY: '' })).toEqual([
      'GROQ_API_KEY: is required when LLM_MODE is live (or set LLM_MODE=mock)',
    ]);
    expect(
      loadEnv(agentEnvSchema, { ...REQUIRED, LLM_MODE: 'live', GROQ_API_KEY: 'gsk_x' }).LLM_MODE,
    ).toBe('live');
  });

  it("needs the agent's own signing key", () => {
    const { SERVICE_PRIVATE_KEY: _omitted, ...withoutKey } = REQUIRED;

    expect(problemsFor(withoutKey)).toEqual([
      'SERVICE_PRIVATE_KEY: is missing: run pnpm setup:keys',
    ]);
  });
});

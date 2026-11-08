import { generateKeyPairSync } from 'node:crypto';
import { EnvError, loadEnv } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { gatewayEnvSchema } from './env-schema.ts';

// A real Ed25519 key made for the test, as `pnpm setup:keys` would write one.
const KEY = generateKeyPairSync('ed25519')
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()
  .trim();
const REQUIRED = {
  REDIS_URL: 'redis://cache',
  FRONTEND_ORIGIN: 'http://localhost:3000',
  AUTH_SERVICE_URL: 'http://localhost:8001',
  CHAT_SERVICE_URL: 'http://localhost:8002',
  AGENT_SERVICE_URL: 'http://localhost:8003',
  BILLING_SERVICE_URL: 'http://localhost:8004',
  INTERNAL_PRIVATE_KEY: KEY,
};

function problemsFor(source: Record<string, string>): string[] {
  try {
    loadEnv(gatewayEnvSchema, source);
  } catch (error) {
    if (error instanceof EnvError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error('expected loadEnv to throw');
}

describe('gateway settings', () => {
  it('reads the required settings and fills in the defaults', () => {
    const env = loadEnv(gatewayEnvSchema, REQUIRED);

    expect(env).toMatchObject({
      PORT: 8000,
      FRONTEND_ORIGIN: ['http://localhost:3000'],
      AUTH_SERVICE_URL: 'http://localhost:8001',
      TRUST_PROXY_HOPS: 1,
    });
  });

  it('takes several frontend origins, separated by commas', () => {
    const env = loadEnv(gatewayEnvSchema, {
      ...REQUIRED,
      FRONTEND_ORIGIN: 'http://localhost:3000, https://gilder.example.com/',
    });

    expect(env.FRONTEND_ORIGIN).toEqual(['http://localhost:3000', 'https://gilder.example.com']);
  });

  it('refuses an origin with a path, or one that is not a URL', () => {
    expect(problemsFor({ ...REQUIRED, FRONTEND_ORIGIN: 'http://localhost:3000/app' })[0]).toMatch(
      /^FRONTEND_ORIGIN\.0: .* must be just an origin/,
    );
    expect(problemsFor({ ...REQUIRED, FRONTEND_ORIGIN: 'localhost' })[0]).toMatch(
      /^FRONTEND_ORIGIN\.0: .* is not a URL/,
    );
  });

  it('needs every service URL to be an http(s) URL', () => {
    expect(problemsFor({ ...REQUIRED, CHAT_SERVICE_URL: 'ftp://chat' })).toEqual([
      'CHAT_SERVICE_URL: must be an http(s) URL',
    ]);
  });

  it('explains a missing or wrong signing key, and accepts escaped line breaks', () => {
    const { INTERNAL_PRIVATE_KEY: _omitted, ...withoutKey } = REQUIRED;

    expect(problemsFor(withoutKey)).toEqual([
      'INTERNAL_PRIVATE_KEY: is missing: run pnpm setup:keys',
    ]);
    expect(problemsFor({ ...REQUIRED, INTERNAL_PRIVATE_KEY: 'SECRET-VALUE' })).toEqual([
      'INTERNAL_PRIVATE_KEY: is not a valid Ed25519 private key: run pnpm setup:keys',
    ]);
    const escaped = loadEnv(gatewayEnvSchema, {
      ...REQUIRED,
      INTERNAL_PRIVATE_KEY: KEY.replaceAll('\n', '\\n'),
    });
    expect(escaped.INTERNAL_PRIVATE_KEY).toBe(KEY);
  });
});

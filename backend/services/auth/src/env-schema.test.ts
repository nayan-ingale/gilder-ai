import { generateKeyPairSync } from 'node:crypto';
import { EnvError, loadEnv } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { authEnvSchema } from './env-schema.ts';

// Shapes only: the schema checks that the key looks like PEM; importing it happens at startup.
const PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----';
// Auth's own signing key is parsed for real, so the test makes one.
const SERVICE_KEY = generateKeyPairSync('ed25519')
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const REQUIRED = {
  MONGODB_URI: 'mongodb://db',
  REDIS_URL: 'redis://cache',
  INTERNAL_PUBLIC_KEY: PUBLIC_KEY,
  SERVICE_PRIVATE_KEY: SERVICE_KEY,
};
const FIREBASE = {
  FIREBASE_PROJECT_ID: 'demo-gilder',
  FIREBASE_CLIENT_EMAIL: 'auth@demo-gilder.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMC4CAQAw\n-----END PRIVATE KEY-----',
};

function problemsFor(source: Record<string, string>): string[] {
  try {
    loadEnv(authEnvSchema, source);
  } catch (error) {
    if (error instanceof EnvError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error('expected loadEnv to throw');
}

describe('auth settings', () => {
  it('needs only the database URLs and the public key in development', () => {
    const env = loadEnv(authEnvSchema, REQUIRED);

    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 8001, AUTH_DEV_LOGIN: false });
    expect(env.FIREBASE_PROJECT_ID).toBeUndefined();
  });

  it('reads AUTH_DEV_LOGIN as a true or false flag', () => {
    expect(loadEnv(authEnvSchema, { ...REQUIRED, AUTH_DEV_LOGIN: 'true' }).AUTH_DEV_LOGIN).toBe(
      true,
    );
    expect(loadEnv(authEnvSchema, { ...REQUIRED, AUTH_DEV_LOGIN: 'false' }).AUTH_DEV_LOGIN).toBe(
      false,
    );
    expect(problemsFor({ ...REQUIRED, AUTH_DEV_LOGIN: 'maybe' })).toEqual([
      'AUTH_DEV_LOGIN: must be true or false',
    ]);
  });

  it('refuses to start in production with dev sign-in on (SEC-09)', () => {
    const problems = problemsFor({
      ...REQUIRED,
      ...FIREBASE,
      NODE_ENV: 'production',
      AUTH_DEV_LOGIN: 'true',
    });

    expect(problems).toEqual([
      'AUTH_DEV_LOGIN: must be false in production: it lets anyone sign in as anyone',
    ]);
  });

  it('starts in production with dev sign-in off and Google sign-in set up', () => {
    const env = loadEnv(authEnvSchema, { ...REQUIRED, ...FIREBASE, NODE_ENV: 'production' });

    expect(env).toMatchObject({ AUTH_DEV_LOGIN: false, FIREBASE_PROJECT_ID: 'demo-gilder' });
  });

  it('requires the Firebase settings in production', () => {
    expect(problemsFor({ ...REQUIRED, NODE_ENV: 'production' })).toEqual([
      'FIREBASE_PROJECT_ID: is required in production, for Google sign-in',
      'FIREBASE_CLIENT_EMAIL: is required in production, for Google sign-in',
      'FIREBASE_PRIVATE_KEY: is required in production, for Google sign-in',
    ]);
  });

  it('treats empty Firebase settings as unset, and wants all three or none', () => {
    const empty = { FIREBASE_PROJECT_ID: '', FIREBASE_CLIENT_EMAIL: ' ', FIREBASE_PRIVATE_KEY: '' };
    expect(loadEnv(authEnvSchema, { ...REQUIRED, ...empty }).FIREBASE_PROJECT_ID).toBeUndefined();

    expect(problemsFor({ ...REQUIRED, FIREBASE_PROJECT_ID: 'demo-gilder' })).toEqual([
      'FIREBASE_CLIENT_EMAIL: set all three Firebase settings, or none',
      'FIREBASE_PRIVATE_KEY: set all three Firebase settings, or none',
    ]);
  });

  it('turns escaped line breaks in the Firebase private key back into real ones', () => {
    const escaped = '-----BEGIN PRIVATE KEY-----\\nMC4CAQAw\\n-----END PRIVATE KEY-----\\n';
    const env = loadEnv(authEnvSchema, { ...REQUIRED, ...FIREBASE, FIREBASE_PRIVATE_KEY: escaped });

    expect(env.FIREBASE_PRIVATE_KEY).toBe(
      '-----BEGIN PRIVATE KEY-----\nMC4CAQAw\n-----END PRIVATE KEY-----\n',
    );
  });

  it('explains a missing or wrong public key, without repeating its value', () => {
    const { INTERNAL_PUBLIC_KEY: _omitted, ...withoutKey } = REQUIRED;

    expect(problemsFor(withoutKey)).toEqual([
      'INTERNAL_PUBLIC_KEY: is missing: run pnpm setup:keys',
    ]);
    const wrong = problemsFor({ ...REQUIRED, INTERNAL_PUBLIC_KEY: 'not-a-key-SECRET123' });
    expect(wrong).toEqual(['INTERNAL_PUBLIC_KEY: is not a PEM public key: run pnpm setup:keys']);
    expect(wrong.join()).not.toContain('SECRET123');
  });

  it("needs auth's own signing key, and defaults billing's URL", () => {
    const { SERVICE_PRIVATE_KEY: _omitted, ...withoutKey } = REQUIRED;

    expect(problemsFor(withoutKey)).toEqual([
      'SERVICE_PRIVATE_KEY: is missing: run pnpm setup:keys',
    ]);
    expect(problemsFor({ ...REQUIRED, SERVICE_PRIVATE_KEY: 'SECRET-VALUE' })).toEqual([
      'SERVICE_PRIVATE_KEY: is not a valid Ed25519 private key: run pnpm setup:keys',
    ]);
    expect(loadEnv(authEnvSchema, REQUIRED).BILLING_SERVICE_URL).toBe('http://localhost:8004');
    expect(
      loadEnv(authEnvSchema, { ...REQUIRED, BILLING_SERVICE_URL: 'http://billing:8004/' })
        .BILLING_SERVICE_URL,
    ).toBe('http://billing:8004');
  });
});

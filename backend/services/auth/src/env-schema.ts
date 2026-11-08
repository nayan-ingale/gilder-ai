import {
  baseEnvSchema,
  internalPrivateKeySchema,
  internalPublicKeySchema,
  portSchema,
  serviceUrlSchema,
  z,
} from '@gilder/shared';

/**
 * The auth service's settings and the rules between them. env.ts loads them at startup; they live
 * in their own file so tests can check the rules without a real environment.
 */

/** A setting that may be left out. Empty counts as unset, as in a fresh copy of .env.example. */
const optionalSetting = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const FIREBASE_SETTINGS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

export const authEnvSchema = baseEnvSchema
  .extend({
    PORT: portSchema(8001),
    MONGODB_URI: z.string().min(1),
    REDIS_URL: z.string().min(1),
    /** The gateway's public key, for checking internal tokens. Written by `pnpm setup:keys`. */
    INTERNAL_PUBLIC_KEY: internalPublicKeySchema,
    /** Auth's own key, for calling billing (the sign-up grant). Written by `pnpm setup:keys`. */
    SERVICE_PRIVATE_KEY: internalPrivateKeySchema,
    BILLING_SERVICE_URL: serviceUrlSchema.default('http://localhost:8004'),
    /** Sign-in with just an email, for local development and tests. Never allowed in production. */
    AUTH_DEV_LOGIN: z.stringbool({ error: 'must be true or false' }).default(false),
    /** Google sign-in: a service account of your own Firebase project. All three, or none. */
    FIREBASE_PROJECT_ID: optionalSetting,
    FIREBASE_CLIENT_EMAIL: optionalSetting,
    // A pasted key often keeps its "\n" escapes: without double quotes in .env, or from a secrets
    // store. They are turned back into line breaks, so the key works either way.
    FIREBASE_PRIVATE_KEY: optionalSetting.transform((value) => value?.replaceAll('\\n', '\n')),
  })
  .superRefine((env, ctx) => {
    const production = env.NODE_ENV === 'production';

    if (production && env.AUTH_DEV_LOGIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_DEV_LOGIN'],
        message: 'must be false in production: it lets anyone sign in as anyone',
      });
    }

    // Production must offer Google sign-in. Elsewhere it is optional, but half a service account
    // is a mistake worth stopping for.
    const missing = FIREBASE_SETTINGS.filter((name) => env[name] === undefined);
    if (missing.length > 0 && (production || missing.length < FIREBASE_SETTINGS.length)) {
      for (const name of missing) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: production
            ? 'is required in production, for Google sign-in'
            : 'set all three Firebase settings, or none',
        });
      }
    }
  });

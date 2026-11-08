import {
  baseEnvSchema,
  internalPrivateKeySchema,
  portSchema,
  serviceUrlSchema,
  z,
} from '@gilder/shared';

/**
 * The gateway's settings. env.ts loads them at startup; they live in their own file so tests can
 * check the rules without a real environment.
 */

/** An http(s) URL with no path, query or fragment, as an origin like http://localhost:3000. */
function toOrigin(value: string, ctx: z.RefinementCtx): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: `"${value}" is not a URL` });
    return z.NEVER;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value.replace(/\/$/, '')) {
    ctx.addIssue({
      code: 'custom',
      message: `"${value}" must be just an origin, like http://localhost:3000`,
    });
    return z.NEVER;
  }
  return url.origin;
}

export const gatewayEnvSchema = baseEnvSchema.extend({
  PORT: portSchema(8000),
  REDIS_URL: z.string().min(1),
  /**
   * Where the browser pages come from: one origin, or several separated by commas. A request
   * that changes something (POST, PUT, PATCH, DELETE) must carry one of these as its Origin.
   */
  FRONTEND_ORIGIN: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().transform(toOrigin)).min(1, 'needs at least one origin')),
  AUTH_SERVICE_URL: serviceUrlSchema,
  CHAT_SERVICE_URL: serviceUrlSchema,
  AGENT_SERVICE_URL: serviceUrlSchema,
  BILLING_SERVICE_URL: serviceUrlSchema,
  /** Signs the internal tokens. Written by `pnpm setup:keys`; escaped \n line breaks are fine. */
  INTERNAL_PRIVATE_KEY: internalPrivateKeySchema,
  /**
   * How many proxies in front of the gateway to trust for the client's IP address (the
   * X-Forwarded-For header): 1 locally (the Next.js server), more behind a load balancer.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
});

export type GatewayEnv = z.output<typeof gatewayEnvSchema>;

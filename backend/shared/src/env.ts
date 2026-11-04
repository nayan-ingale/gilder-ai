import { z } from 'zod';

/** Variables every app reads. Apps extend this with their own (see each app's src/env.ts). */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/** A TCP port, with the app's default when the variable is not set. */
export function portSchema(defaultPort: number) {
  return z.coerce.number().int().min(1).max(65_535).default(defaultPort);
}

export class EnvError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      `Invalid environment variables:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
    );
    this.name = 'EnvError';
    this.problems = problems;
  }
}

/**
 * Validates environment variables at startup. Throws an EnvError listing every problem at once,
 * so a misconfigured app refuses to start instead of failing later on first use.
 * Messages name the variable but never echo its value, so secrets cannot leak into logs.
 */
export function loadEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.output<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}

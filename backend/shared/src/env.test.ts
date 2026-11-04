import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { baseEnvSchema, EnvError, loadEnv, portSchema } from './env.ts';

const schema = baseEnvSchema.extend({
  PORT: portSchema(8000),
  MONGODB_URI: z.string().min(1),
});

function problemsFor(source: Record<string, string>): string[] {
  try {
    loadEnv(schema, source);
  } catch (error) {
    if (error instanceof EnvError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error('expected loadEnv to throw');
}

describe('loadEnv', () => {
  it('applies defaults and converts types', () => {
    expect(loadEnv(schema, { MONGODB_URI: 'mongodb://db' })).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      PORT: 8000,
      MONGODB_URI: 'mongodb://db',
    });
    expect(loadEnv(schema, { MONGODB_URI: 'mongodb://db', PORT: '9001' }).PORT).toBe(9001);
  });

  it('reports every problem at once, by variable name', () => {
    const problems = problemsFor({ PORT: 'abc', NODE_ENV: 'staging' });

    expect(problems).toHaveLength(3);
    expect(problems.some((problem) => problem.startsWith('PORT:'))).toBe(true);
    expect(problems.some((problem) => problem.startsWith('NODE_ENV:'))).toBe(true);
    expect(problems.some((problem) => problem.startsWith('MONGODB_URI:'))).toBe(true);
  });

  it('never repeats a value in its messages, so secrets cannot leak into logs', () => {
    const problems = problemsFor({ MONGODB_URI: '', PORT: 'super-secret-value' });

    expect(problems.join('\n')).not.toContain('super-secret-value');
  });
});

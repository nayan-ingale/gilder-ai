import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError, type FieldError } from './errors.ts';

export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

/**
 * Validates request params, query and body with Zod. On failure responds 400 with every field
 * error at once; on success replaces each part with the parsed (typed, coerced) value.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const errors: FieldError[] = [];
    const parsed: Partial<Record<keyof RequestSchemas, unknown>> = {};

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) {
        continue;
      }
      const result = schema.safeParse(req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            path: [part, ...issue.path.map(String)].join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (errors.length > 0) {
      next(new AppError('validation_failed', 'Some fields are invalid', { fieldErrors: errors }));
      return;
    }

    if ('body' in parsed) {
      req.body = parsed.body;
    }
    if ('params' in parsed) {
      req.params = parsed.params as typeof req.params;
    }
    if ('query' in parsed) {
      // Express 5 exposes req.query through a getter, so it has to be redefined, not assigned.
      Object.defineProperty(req, 'query', {
        value: parsed.query,
        writable: true,
        enumerable: true,
      });
    }
    next();
  };
}

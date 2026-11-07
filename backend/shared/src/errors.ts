import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from './logger.ts';

export const ERROR_CODES = {
  bad_request: { status: 400, title: 'Bad request' },
  validation_failed: { status: 400, title: 'Validation failed' },
  unauthorized: { status: 401, title: 'Unauthorized' },
  insufficient_credits: { status: 402, title: 'Insufficient credits' },
  forbidden: { status: 403, title: 'Forbidden' },
  not_found: { status: 404, title: 'Not found' },
  conflict: { status: 409, title: 'Conflict' },
  payload_too_large: { status: 413, title: 'Payload too large' },
  unsupported_media_type: { status: 415, title: 'Unsupported media type' },
  rate_limited: { status: 429, title: 'Too many requests' },
  internal_error: { status: 500, title: 'Internal error' },
  service_unavailable: { status: 503, title: 'Service unavailable' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface FieldError {
  path: string;
  message: string;
}

/** An error the API is allowed to describe to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: FieldError[] | undefined;

  constructor(
    code: ErrorCode,
    message?: string,
    options: { fieldErrors?: FieldError[]; cause?: unknown } = {},
  ) {
    super(message ?? ERROR_CODES[code].title, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CODES[code].status;
    this.fieldErrors = options.fieldErrors;
  }
}

/** The JSON error body (RFC 9457, application/problem+json). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  requestId?: string;
  errors?: FieldError[];
}

export function toProblem(error: AppError, requestId?: string): ProblemDetails {
  return {
    type: `/errors/${error.code}`,
    title: ERROR_CODES[error.code].title,
    status: error.status,
    code: error.code,
    // Server-side failures never describe themselves to the client; the details are in the logs.
    ...(error.status < 500 ? { detail: error.message } : {}),
    ...(requestId ? { requestId } : {}),
    ...(error.fieldErrors ? { errors: error.fieldErrors } : {}),
  };
}

export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new AppError('not_found', `No route for ${req.method} ${req.path}`));
  };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      // A response (for example a stream) has already started; let Express close the connection.
      next(err);
      return;
    }
    const error = toAppError(err);
    if (error.status >= 500) {
      logger.error({ err }, 'request failed');
    }
    res
      .status(error.status)
      .type('application/problem+json')
      .json(toProblem(error, res.locals.requestId));
  };
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  // Errors thrown by Express's JSON body parser carry a `type` field.
  if (typeof err === 'object' && err !== null && 'type' in err) {
    if (err.type === 'entity.too.large') {
      return new AppError('payload_too_large');
    }
    if (err.type === 'entity.parse.failed') {
      return new AppError('bad_request', 'The request body is not valid JSON');
    }
    // The client sent a body the parser can't read: the caller has to fix it, so these are 415s,
    // not server failures. The messages are fixed, so the client's header values are never echoed.
    if (err.type === 'charset.unsupported') {
      return new AppError('unsupported_media_type', 'The request body uses an unsupported charset');
    }
    if (err.type === 'encoding.unsupported') {
      return new AppError(
        'unsupported_media_type',
        'The request body uses an unsupported Content-Encoding',
      );
    }
  }
  return new AppError('internal_error', undefined, { cause: err });
}

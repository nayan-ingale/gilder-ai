import type { DocPage } from '../schema.ts';

export const errorHandlingPage: DocPage = {
  id: 'error-handling',
  title: 'Error handling',
  summary:
    'How an error in any backend app becomes a JSON error response, what that response contains, and what gets logged.',
  section: 'errors',
  sections: [
    {
      id: 'overview',
      title: 'From an error to a JSON reply',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "All five backend apps handle errors the same way, with code from the shared library. A route can throw, return a rejected promise or call `next(err)`, and Express 5 sends all three to the error handler. `createService` adds two handlers after the app's routes: `notFoundHandler` for requests no route matched, then `errorHandler` for every error.",
        },
        {
          kind: 'list',
          items: [
            '`errorHandler` turns the error into an `AppError` (`toAppError`).',
            'It logs the error when the status is 500 or more.',
            '`toProblem` builds the body, which is sent as `application/problem+json` (the RFC 9457 error format).',
          ],
        },
        {
          kind: 'text',
          text: "No app has routes of its own yet, so in a running app errors come only from the 404 handler and the JSON body parser. Errors thrown by routes are covered by the shared library's tests.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/service.ts',
          text: '  app.use(notFoundHandler());\n  app.use(errorHandler(logger));',
          caption: 'createService adds the two handlers last, so every error reaches them',
        },
      ],
      refs: [
        { flow: 'error-handling' },
        { symbol: 'backend/shared/src/service.ts#createService' },
        { symbol: 'backend/shared/src/errors.ts#errorHandler' },
      ],
    },
    {
      id: 'error-codes',
      title: 'AppError and the error codes',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: '`AppError` marks an error as safe to describe to the client. It takes a code from `ERROR_CODES`, which sets the HTTP status and the title; the message defaults to the title. Any other error becomes a generic 500.',
        },
        {
          kind: 'table',
          columns: ['Code', 'Status', 'Title'],
          rows: [
            ['`bad_request`', '400', 'Bad request'],
            ['`validation_failed`', '400', 'Validation failed'],
            ['`unauthorized`', '401', 'Unauthorized'],
            ['`insufficient_credits`', '402', 'Insufficient credits'],
            ['`forbidden`', '403', 'Forbidden'],
            ['`not_found`', '404', 'Not found'],
            ['`conflict`', '409', 'Conflict'],
            ['`payload_too_large`', '413', 'Payload too large'],
            ['`unsupported_media_type`', '415', 'Unsupported media type'],
            ['`rate_limited`', '429', 'Too many requests'],
            ['`internal_error`', '500', 'Internal error'],
            ['`service_unavailable`', '503', 'Service unavailable'],
          ],
        },
        {
          kind: 'text',
          text: 'A running app only produces `not_found`, `bad_request`, `payload_too_large`, `unsupported_media_type` and `internal_error` today. `validation_failed` comes from `validate`, `unauthorized` from `requireInternalToken` and `requireUser`, and `rate_limited` from `rateLimit`; no app uses those yet. The other codes are ready for later features.',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/errors.ts#AppError' },
        { symbol: 'backend/shared/src/errors.ts#ERROR_CODES' },
      ],
    },
    {
      id: 'sorting',
      title: 'How the handler sorts errors',
      status: 'verified',
      blocks: [
        {
          kind: 'list',
          items: [
            'An `AppError` is kept as it is.',
            'A JSON body over the size limit (64kb unless an app changes it) becomes `payload_too_large` (413).',
            "A body that is not valid JSON becomes `bad_request` (400), with the detail 'The request body is not valid JSON'.",
            "A JSON body in a charset the parser cannot read (such as `charset=latin1`) or with an unknown `Content-Encoding` becomes `unsupported_media_type` (415), with the detail 'The request body uses an unsupported charset' or 'The request body uses an unsupported Content-Encoding'. The messages are fixed, so the client's header values are never echoed back.",
            'Anything else becomes `internal_error` (500), keeping the original error as its `cause`. In a running app that includes a body-parser failure the handler does not map, such as a body sent with `Content-Encoding: gzip` that is not valid gzip.',
            'If the response has already started, an error body can no longer be sent, so the handler passes the error on to Express, which closes the connection. No app streams responses yet, so this does not happen today.',
          ],
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/errors.ts',
          text: "return new AppError('internal_error', undefined, { cause: err });",
          caption: 'toAppError: the last case, for any error it does not know',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/errors.ts#toAppError' },
        { symbol: 'backend/shared/src/errors.ts#errorHandler' },
        { flow: 'error-handling' },
      ],
    },
    {
      id: 'not-found',
      title: 'Unknown routes: 404',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "When no route matches, `notFoundHandler` passes on an `AppError('not_found')` with a message such as 'No route for GET /nothing'. The client gets the same problem+json body as for any other error, not Express's default HTML page. Since no app has its own routes yet, every request except GET, HEAD and OPTIONS on `/healthz` and `/readyz` ends here, unless its JSON body is rejected first.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/errors.ts',
          text: "next(new AppError('not_found', `No route for ${req.method} ${req.path}`));",
        },
      ],
      refs: [{ flow: 'unknown-route' }, { symbol: 'backend/shared/src/errors.ts#notFoundHandler' }],
    },
    {
      id: 'validation',
      title: 'Validation errors: 400',
      status: 'not-wired',
      blocks: [
        {
          kind: 'text',
          text: "`validate` checks a request's params, query and body with Zod schemas and collects every problem at once. It then passes on one `AppError('validation_failed')` with the field errors. The client gets a 400 whose `errors` list holds a `path` (such as `body.name`) and a `message` for each bad field. It is built and tested, but no route uses it yet.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/validate.ts',
          text: "next(new AppError('validation_failed', 'Some fields are invalid', { fieldErrors: errors }));",
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/validate.ts#validate' },
        { file: 'backend/shared/src/service.test.ts' },
      ],
    },
    {
      id: 'response-body',
      title: 'What the client gets',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'Every error reply has the matching HTTP status and the content type `application/problem+json`. The body holds these fields:',
        },
        {
          kind: 'table',
          columns: ['Field', 'When', 'What'],
          rows: [
            ['`type`', 'Always', '`/errors/` and the code, such as `/errors/not_found`'],
            ['`title`', 'Always', 'The title from `ERROR_CODES`'],
            ['`status`', 'Always', 'The HTTP status'],
            ['`code`', 'Always', 'The error code: a fixed value clients can check'],
            [
              '`detail`',
              'Status below 500',
              'The error message. Left out for 500s, so internal details never reach the client',
            ],
            [
              '`requestId`',
              'When the request has an ID, which in a running app is always',
              'The same ID as the `X-Request-Id` response header, to find the log lines',
            ],
            ['`errors`', 'Validation errors only', 'One `path` and `message` per bad field'],
          ],
        },
        {
          kind: 'text',
          text: "For example, `GET /nothing` on any app answers 404 with `{ type: '/errors/not_found', title: 'Not found', status: 404, code: 'not_found', detail: 'No route for GET /nothing', requestId }`.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/errors.ts',
          text: '    ...(error.status < 500 ? { detail: error.message } : {}),\n    ...(requestId ? { requestId } : {}),',
          caption: 'toProblem: detail only below 500, and the request ID when there is one',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/errors.ts#toProblem' },
        { symbol: 'backend/shared/src/errors.ts#ProblemDetails' },
        { symbol: 'backend/shared/src/requestId.ts#requestId' },
      ],
    },
    {
      id: 'logging',
      title: 'What gets logged',
      status: 'verified',
      blocks: [
        {
          kind: 'list',
          items: [
            "For a status of 500 or more, `errorHandler` logs 'request failed' at error level, with the original error and its stack.",
            'For a 4xx error, the handler logs nothing itself.',
            "In both cases the request logger (pino-http) then writes its line for the finished request: at warn for a 4xx (a 415 for an unreadable body included), and at error with the message 'request errored' for a 5xx. It skips only health probes, a GET or HEAD on `/healthz` or `/readyz`, so `POST /healthz` gets a 404 and a warn line.",
            'All these lines carry the request ID, the same one the client sees in the body.',
          ],
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/errors.ts',
          text: "logger.error({ err }, 'request failed');",
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/errors.ts#errorHandler' },
        { symbol: 'backend/shared/src/service.ts#createService' },
        { flow: 'error-handling' },
      ],
    },
    {
      id: 'startup',
      title: 'Errors at startup',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "Errors before an app is listening are not HTTP errors. A missing or invalid setting makes `loadEnv` throw an `EnvError` that lists every problem, naming each variable but never its value. Auth also stops when its settings break a rule between them, such as `AUTH_DEV_LOGIN=true` in production. If MongoDB does not answer within 5 seconds, or the port is taken, the app stops too. In each case nothing catches the error, so Node prints it and exits with code 1. A Redis outage does not stop an app: the client logs 'redis error', and `/readyz` reports Redis as failed.",
        },
      ],
      refs: [
        { flow: 'app-startup' },
        { flow: 'readiness-check' },
        { symbol: 'backend/shared/src/env.ts#loadEnv' },
        { symbol: 'backend/shared/src/env.ts#EnvError' },
        { symbol: 'backend/shared/src/mongo.ts#connectMongo' },
        { symbol: 'backend/shared/src/redis.ts#createRedis' },
      ],
    },
  ],
};

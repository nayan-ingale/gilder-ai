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
          text: "Auth, chat, agent and billing raise 401 from their internal-token check, and errors from their own routes. The gateway raises errors from its checks (429, 403, 401), from its body reader (413) and from its proxy (503), and passes each service's own error replies back unchanged: status, Content-Type and body.",
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
        { flow: 'direct-service-call' },
        { symbol: 'backend/shared/src/service.ts#createService' },
        { symbol: 'backend/shared/src/errors.ts#errorHandler' },
        { symbol: 'backend/gateway/src/proxy.ts#proxyToService' },
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
          text: "Every app can produce `not_found`, `payload_too_large`, `unsupported_media_type` and `internal_error`, and the services also `bad_request` from their JSON body parser, which the gateway does not use. The services produce `unauthorized` from `requireInternalToken`. Auth also produces `validation_failed` (from `validate`), `unauthorized` (from `requireUser` and its own sign-in and `/me` checks) and `service_unavailable` (Google sign-in without the Firebase settings). Chat produces `validation_failed` (from `validate`), `unauthorized` (from `requireUser`), `forbidden` (`requireCaller` on its /internal routes), `bad_request` (a cursor it did not make) and `not_found` ('No such chat' or 'No such message', the same for another user's as for a missing one). Billing produces `validation_failed`, `unauthorized`, `forbidden` (a signer not allowed on an /internal route), `insufficient_credits` (402, too few credits for a hold), `conflict` (a hold already settled the other way, or an idempotency key used by another user) and `not_found` ('No such reservation'); its payment routes add `bad_request` (a checkout or webhook signature that does not match), `not_found` ('No such order', also for someone else's) and `service_unavailable` (payments not set up, or Razorpay not answering), and its usage summary `validation_failed` for a time zone it does not know. The agent's answer routes produce `validation_failed`, `bad_request` (a shortcut with no message), `not_found` (a chat passed on from chat, a turn with nothing to stop, or an attached file that is missing, not the user's or not uploaded yet), `conflict` (a request already being answered or already answered, a regenerate or edit that is not on the latest turn, or an attached PDF still being read or that could not be read), `rate_limited` (over the routed agent's per-minute limit, with Retry-After) and `insufficient_credits` (no credits at all, or too few for the agent, passed on from billing), all before the stream starts; once the stream has started, a failure is an `error` event in the stream, not a status: for example a PDF question in a chat with no readable PDF, an outline the model cannot get right after one repair, or an image service that does not answer. Its file routes produce `validation_failed`, `unsupported_media_type` (a type it does not take, or a file whose bytes are not what it claims, which is then deleted), `payload_too_large` (over the type's limit), `not_found` (a chat passed on from chat, or a file that is not the user's), `conflict` (an upload that has not arrived yet, or was refused) and `service_unavailable` (uploads not set up). The gateway produces `rate_limited` (its rate limits), `forbidden` (`originCheck`, on every route but the webhook), `unauthorized` (`requireSession`) and `service_unavailable` (a service that is down or slow). Calls between services (`createInternalClient`) keep the other service's 4xx code and turn a 5xx, a timeout or a refused connection into `service_unavailable`.",
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
            'If the response has already started, an error body can no longer be sent, so the handler passes the error on to Express, which closes the connection. The gateway streams answers back from the services, but it throws nothing once it has started writing (a failed stream destroys the response instead), so no code is known to reach this.',
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
          text: "When no route matches, `notFoundHandler` passes on an `AppError('not_found')` with a message such as 'No route for GET /nothing'. The client gets the same problem+json body as for any other error, not Express's default HTML page. In the gateway, every path that is not in its route table ends here, so it never reaches a service (SEC-01). In auth, chat, agent and billing only a request with a valid internal token gets this far; without one it gets a 401.",
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
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "`validate` checks a request's params, query and body with Zod schemas and collects every problem at once. It then passes on one `AppError('validation_failed')` with the field errors. The client gets a 400 whose `errors` list holds a `path` (such as `body.name`) and a `message` for each bad field. Auth's routes use it, so a sign-in without a Google token, a dev sign-in with a bad email, an unknown theme for `PATCH /me` or a malformed user ID gets this 400.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/validate.ts',
          text: "next(new AppError('validation_failed', 'Some fields are invalid', { fieldErrors: errors }));",
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/validate.ts#validate' },
        { symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter' },
        { symbol: 'backend/services/auth/src/me-routes.ts#meRouter' },
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
          text: "For example, `GET /nothing` on the gateway answers 404 with `{ type: '/errors/not_found', title: 'Not found', status: 404, code: 'not_found', detail: 'No route for GET /nothing', requestId }`. On a service the same request without an internal token gets a 401 with the code `unauthorized` and the detail 'Missing internal token'.",
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
            "In both cases the request logger (pino-http) then writes its line for the finished request: at warn for a 4xx (a 415 for an unreadable body included), and at error with the message 'request errored' for a 5xx. It skips only health probes, a GET or HEAD on `/healthz` or `/readyz`, so `POST /healthz` gets a 404 (on a service, a 401 without an internal token) and a warn line. A 503 from the gateway's proxy is a 5xx, so it is logged as 'request failed'.",
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
          text: "Errors before an app is listening are not HTTP errors. A missing or invalid setting makes `loadEnv` throw an `EnvError` that lists every problem, naming each variable but never its value. Auth also stops when its settings break a rule between them, such as `AUTH_DEV_LOGIN=true` in production. If MongoDB does not answer within 5 seconds, a service's `INTERNAL_PUBLIC_KEY` cannot be imported as a key, or the port is taken, the app stops too. In each case nothing catches the error, so Node prints it and exits with code 1. A Redis outage does not stop an app: the client logs 'redis error', and `/readyz` reports Redis as failed.",
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

import type { DocPage } from '../schema.ts';

export const loggingPage: DocPage = {
  id: 'logging',
  title: 'Logging',
  summary:
    'How the backend apps write logs: one pino logger, readable in development and JSON elsewhere, with secrets hidden and a request ID on every line written during a request.',
  sections: [
    {
      id: 'logger',
      title: 'One logger for every app',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "Each backend app makes its logger once, at startup, with `createLogger` from the shared library, and hands it to everything that logs. It is a pino logger. Every line has the level as a word (such as `info`), an ISO timestamp (`time`), the app's name (`service`) and a message (`msg`).",
        },
        {
          kind: 'quote',
          file: 'backend/gateway/src/index.ts',
          text: "const logger = createLogger({\n  service: 'gateway',\n  level: env.LOG_LEVEL,\n  pretty: env.NODE_ENV === 'development',\n});",
          caption: 'The gateway makes its logger; the other apps do the same with their own name',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
        { symbol: 'backend/gateway/src/index.ts#logger' },
        { flow: 'app-startup' },
      ],
    },
    {
      id: 'levels',
      title: 'Levels',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'The level comes from the `LOG_LEVEL` setting: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`, and `info` when it is not set. Lines below that level are skipped. The app, service, mongo and internal-token tests use `silent`; `logger.test.ts` keeps the default `info` and captures the lines to check them. Today the code writes these lines:',
        },
        {
          kind: 'table',
          columns: ['Level', 'Lines'],
          rows: [
            [
              'error',
              "Requests that ended with a 5xx, 'request failed', 'redis error', 'shutdown failed'",
            ],
            ['warn', "Requests that ended with a 4xx, 'readiness check failed'"],
            [
              'info',
              "Other requests, 'listening', 'mongodb connected', 'shutting down', 'shut down cleanly'",
            ],
          ],
        },
        {
          kind: 'text',
          text: 'Nothing logs at `fatal`, `debug` or `trace` yet.',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/env.ts#baseEnvSchema' },
        { symbol: 'backend/shared/src/service.ts#createService' },
        { symbol: 'backend/shared/src/errors.ts#errorHandler' },
        { symbol: 'backend/shared/src/health.ts#healthRouter' },
      ],
    },
    {
      id: 'output',
      title: 'Readable in development, JSON elsewhere',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'Each app turns on `pretty` when `NODE_ENV` is `development`. Its lines then go through pino-pretty: colored, with a short local time and without the process ID and host name. Otherwise each line is one JSON object on stdout, ready for a log tool to collect, such as `{"level":"info","time":"2026-01-15T09:30:00.000Z","service":"gateway","port":8000,"msg":"listening"}`.',
        },
        {
          kind: 'text',
          text: '`NODE_ENV` defaults to `development`, so an app writes JSON only when `NODE_ENV` is set to `production` or `test`.',
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/logger.ts',
          text: "        target: 'pino-pretty',\n        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },",
          caption: 'createLogger with pretty: true',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
        { symbol: 'backend/shared/src/env.ts#baseEnvSchema' },
      ],
    },
    {
      id: 'redaction',
      title: 'Secrets are hidden',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'Before a line is written, pino replaces the fields listed in `REDACTED_PATHS` with "[REDACTED]": the Authorization, Cookie and x-internal-token request headers, the Set-Cookie response header, and any field named `password`, `token`, `idToken`, `apiKey`, `secret` or `signature`, at the top level or one level down (such as `user.token`).',
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/logger.ts',
          text: "  'req.headers.authorization',\n  'req.headers.cookie',\n  'req.headers[\"x-internal-token\"]',\n  'res.headers[\"set-cookie\"]',",
          caption: 'The start of REDACTED_PATHS',
        },
        {
          kind: 'text',
          text: 'Redaction goes by field name, not by content. A field two levels down (such as `a.b.password`) is not hidden, and neither is a secret inside a message or an error text. So the code avoids logging secrets in the first place: `connectMongo`, for example, logs the database name but never the connection string.',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/logger.ts#REDACTED_PATHS' },
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
        { symbol: 'backend/shared/src/mongo.ts#connectMongo' },
        { file: 'backend/shared/src/logger.test.ts' },
      ],
    },
    {
      id: 'request-ids',
      title: 'A request ID on every line written during a request',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "The `requestId` middleware runs first in every app. It takes the caller's `X-Request-Id` when it looks safe, or makes a new UUID, and starts a request context with `runWithContext`. The context lives in Node's `AsyncLocalStorage`, so it follows the request through every `await` and callback. The logger's `mixin` reads it with `getContext` and adds `requestId` to each line written during the request, so no code has to pass the ID around. Lines written outside a request, such as 'listening', have none.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/context.ts',
          text: 'const storage = new AsyncLocalStorage<RequestContext>();',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/requestId.ts#requestId' },
        { symbol: 'backend/shared/src/context.ts#runWithContext' },
        { symbol: 'backend/shared/src/context.ts#getContext' },
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
        { flow: 'unknown-route' },
      ],
    },
    {
      id: 'user-id',
      title: 'The user on every line',
      status: 'not-wired',
      blocks: [
        {
          kind: 'text',
          text: 'The same context can hold the user. `setContextUserId` records the user ID, and from then on the mixin adds `userId` next to `requestId`. Only `requireInternalToken` calls it, after checking the token from the gateway, and no app uses that middleware yet. So today no log line carries a user. It is planned to be wired in Sign-in and sessions.',
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/logger.ts',
          text: '      return context.userId\n        ? { requestId: context.requestId, userId: context.userId }\n        : { requestId: context.requestId };',
          caption: 'The mixin in createLogger',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/context.ts#setContextUserId' },
        { symbol: 'backend/shared/src/internalToken.ts#requireInternalToken' },
      ],
    },
    {
      id: 'request-logs',
      title: 'One line per request',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "`createService` adds pino-http right after the request ID. When a response finishes, it writes one line with the request (`req`: ID, method, URL and headers, with secrets hidden), the response (`res`: status and headers), `responseTime` in milliseconds and the message 'request completed' ('request errored' for a 5xx). pino-http 11 also writes 'request aborted' when the client disconnects before the response ends. The level follows the status: error for 5xx, warn for 4xx, info otherwise. pino-http takes its `req.id` from the `X-Request-Id` response header, so it matches `requestId`. pino-http skips any request whose URL is exactly `/healthz` or `/readyz`, whatever its method or status (so `POST /healthz` gets a 404 with no request line); every other request gets one line. This keeps health checks from flooding the logs.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/service.ts',
          text: "autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },",
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/service.ts#createService' },
        { flow: 'unknown-route' },
        { flow: 'health-check' },
      ],
    },
  ],
};

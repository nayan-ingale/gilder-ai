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
          text: 'The level comes from the `LOG_LEVEL` setting: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`, and `info` when it is not set. Lines below that level are skipped. The app, service, mongo, internal-token and rate-limit tests use `silent`; `logger.test.ts`, and the request-logging and double-SIGINT tests in `service.test.ts`, keep the default `info` and capture the lines to check them. Today the code writes these lines:',
        },
        {
          kind: 'table',
          columns: ['Level', 'Lines'],
          rows: [
            [
              'error',
              "Requests that ended with a 5xx, 'request failed', 'redis error', 'shutdown failed', 'shutdown timed out', the agent's 'the answer failed', 'could not settle an unfinished answer' and 'redis stop-signal subscriber error', and billing's 'the stale reservation sweep failed; it runs again shortly'",
            ],
            [
              'warn',
              "Requests that ended with a 4xx, 'readiness check failed', and at auth's startup 'Google sign-in is not set up: the FIREBASE_* settings are empty' and 'dev sign-in is on: anyone who can reach auth can sign in with just an email', auth's 'sign-up credits could not be granted; the next sign-in asks again', and the agent's 'model failed before answering; trying the next one', 'routing failed; answering with chat', 'could not title the chat' and 'could not save an AI call record'",
            ],
            [
              'info',
              "Other requests, 'listening', 'mongodb connected', 'shutting down', 'already shutting down', 'shut down cleanly', auth's 'signed in' (with the method and whether the user is new) and 'signed out', the agent's 'AI answers are live' or 'AI answers are mocked' and 'agents ready' (with the agents it runs) at startup, and billing's 'released stale credit reservations' (with the count)",
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
          text: "The `requestId` middleware runs first in every app. It takes the caller's `X-Request-Id` when it looks safe, or makes a new UUID, and starts a request context with `runWithContext`. The context lives in Node's `AsyncLocalStorage`, so it follows the request through every `await` and callback. The logger's `mixin` reads it with `getContext` and adds `requestId` to each line written during the request, so no code has to pass the ID around. Lines written outside a request, such as 'listening', have none. The gateway sends its request ID on to the service it calls, in `X-Request-Id`, and the service reuses it, so the lines of both apps for one request share one ID. Auth and the agent do the same when they call another service (`createInternalClient` sends the current ID along), so a sign-in's lines in auth and billing, and a turn's in the agent, chat and billing, share it too.",
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
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "The same context can hold the user. `setContextUserId` records the user ID, and from then on the mixin adds `userId` next to `requestId`. Three places call it. In the gateway, `sessionLookup` calls it once the session cookie names a user, so the gateway's later lines for that request carry the user. In a service, `requireInternalToken` calls it after checking the token from the gateway, auth or the agent, when the token names a user: a request with no session, such as a sign-in, gets a token without one. Auth's sign-in calls it once it knows who signed in, so its 'signed in' line carries the user.",
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
        { symbol: 'backend/gateway/src/guards.ts#sessionLookup' },
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
          text: "`createService` adds pino-http right after the request ID. When a response finishes, it writes one line with the request (`req`: ID, method, URL and headers, with secrets hidden), the response (`res`: status and headers), `responseTime` in milliseconds and the message 'request completed' ('request errored' for a 5xx). pino-http 11 also writes 'request aborted' when the client disconnects before the response ends. The level follows the status: error for 5xx, warn for 4xx, info otherwise. pino-http takes its `req.id` from the `X-Request-Id` response header, so it matches `requestId`. pino-http skips only health probes: a GET or HEAD on `/healthz` or `/readyz`, with or without a query string (`isHealthProbe`). Every other request gets one line, including any other method on those paths: `POST /healthz` gets a 404 (on auth, a 401 without an internal token) and a warn line. This keeps health checks from flooding the logs, while calls that use those paths by mistake still show.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/service.ts',
          text: 'autoLogging: { ignore: isHealthProbe },',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/service.ts#createService' },
        { symbol: 'backend/shared/src/health.ts#isHealthProbe' },
        { flow: 'unknown-route' },
        { flow: 'health-check' },
      ],
    },
  ],
};

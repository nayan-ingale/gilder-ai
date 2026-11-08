import type { SymbolNote } from './schema.ts';

/**
 * Notes on each function, class, method and constant: what it is for, in words. Signatures,
 * lines and callers come from the generated index, so they are not repeated here.
 */

const CONSTANTS_TEST = 'backend/shared/src/constants.test.ts';
const ENV_TEST = 'backend/shared/src/env.test.ts';
const INTERNAL_TOKEN_TEST = 'backend/shared/src/internalToken.test.ts';
const LOGGER_TEST = 'backend/shared/src/logger.test.ts';
const MONGO_TEST = 'backend/shared/src/mongo.test.ts';
const RATE_LIMIT_TEST = 'backend/shared/src/rateLimit.test.ts';
const SERVICE_TEST = 'backend/shared/src/service.test.ts';
const SESSIONS_TEST = 'backend/shared/src/sessions.test.ts';

const GATEWAY_TEST = 'backend/gateway/src/app.test.ts';
const AUTH_TEST = 'backend/services/auth/src/app.test.ts';
const AUTH_ENV_SCHEMA_TEST = 'backend/services/auth/src/env-schema.test.ts';
const AUTH_USERS_TEST = 'backend/services/auth/src/users.test.ts';
const AUTH_FIREBASE_TEST = 'backend/services/auth/src/firebase.test.ts';
const AUTH_SESSION_ROUTES_TEST = 'backend/services/auth/src/session-routes.test.ts';
const AUTH_ME_ROUTES_TEST = 'backend/services/auth/src/me-routes.test.ts';
const CHAT_TEST = 'backend/services/chat/src/app.test.ts';
const AGENT_TEST = 'backend/services/agent/src/app.test.ts';
const BILLING_TEST = 'backend/services/billing/src/app.test.ts';

/** Each app's test sends /healthz, /readyz and an unknown route through the shared middleware. */
const APP_TESTS = [GATEWAY_TEST, AUTH_TEST, CHAT_TEST, AGENT_TEST, BILLING_TEST];

export const notes: SymbolNote[] = [
  // -------------------------------------------------------------------------------------------
  // backend/shared/src/constants.ts

  {
    symbol: 'backend/shared/src/constants.ts#AGENTS',
    status: 'not-wired',
    summary: 'The list of every agent a chat turn can run.',
    why: 'One list that the rest of the code shares, so agent names are spelled the same everywhere. The `Agent` type is built from it, so code typed with Agent cannot use a misspelled name. Nothing outside the tests reads it yet.',
    returns:
      'A read-only array of eight names: chat, search, code, pdf, slides, image, pdf_qa and image_qa.',
    tests: [CONSTANTS_TEST],
  },
  {
    symbol: 'backend/shared/src/constants.ts#CREDIT_COSTS',
    status: 'not-wired',
    summary: 'How many credits one answer from each agent costs.',
    why: 'Prices live in one place, next to the agent list. It is typed as a record over every agent, so adding an agent without a price fails the typecheck. Its comment notes that choosing the agent (the router call) is free. Nothing outside the tests reads it yet.',
    returns: 'chat costs 1 credit, search 5, and every other agent 10.',
    tests: [CONSTANTS_TEST],
  },
  {
    symbol: 'backend/shared/src/constants.ts#AGENT_RATE_LIMITS',
    status: 'not-wired',
    summary: 'How many requests per minute each user may send to each agent.',
    why: 'Each agent gets its own limit, so the costlier agents can be held tighter than plain chat. Like CREDIT_COSTS, every agent must have an entry or the typecheck fails. Nothing outside the tests reads it yet.',
    returns: 'chat allows 20 requests a minute; every other agent allows 5.',
    tests: [CONSTANTS_TEST],
  },
  {
    symbol: 'backend/shared/src/constants.ts#SIGNUP_CREDITS',
    status: 'not-wired',
    summary: 'The credits every new account starts with.',
    why: 'Named once so the sign-up grant and the Free plan cannot drift apart: PLANS.free uses it for its credits. Only PLANS and the tests read it, and nothing uses PLANS yet.',
    returns: 'The number 100.',
    tests: [CONSTANTS_TEST],
  },
  {
    symbol: 'backend/shared/src/constants.ts#PLANS',
    status: 'not-wired',
    summary: 'The three plans a user can have: Free, Starter and Pro.',
    how: [
      'Prices are in paise (₹1 = 100 paise), the unit Razorpay works in.',
      '`satisfies Record<string, Plan>` checks that each plan has every field of Plan.',
      '`as const` keeps the exact values, so code can rely on them as types.',
    ],
    why: 'Whole numbers of paise avoid rounding errors with money. Per its comment, `validityDays` is how long a plan badge lasts; purchased credits never expire. Nothing outside the tests reads it yet.',
    returns:
      'Free: 0 paise and 100 credits. Starter: 19,900 paise (₹199) and 500 credits. Pro: 49,900 paise (₹499) and 1,000 credits. Each lasts 30 days.',
    tests: [CONSTANTS_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/context.ts

  {
    symbol: 'backend/shared/src/context.ts#storage',
    status: 'verified',
    summary: 'The AsyncLocalStorage that holds the context of the request being handled.',
    why: 'It is private to context.ts, so the only way to set, read or change the context is through runWithContext, getContext and setContextUserId.',
    returns:
      'An AsyncLocalStorage of RequestContext values (a request ID and, once known, a user ID).',
    tests: [LOGGER_TEST],
  },
  {
    symbol: 'backend/shared/src/context.ts#runWithContext',
    status: 'verified',
    summary: 'Runs a function with a request context (the request ID, later the user) attached.',
    how: [
      'It calls `storage.run(context, fn)`.',
      'Everything `fn` starts, including code it awaits, can read the context with getContext().',
    ],
    why: 'Logs need the request ID, but passing it to every function by hand is tedious and easy to forget. AsyncLocalStorage carries it along the async call chain instead. The requestId middleware calls it for every request in every app.',
    returns: 'Whatever `fn` returns.',
    tests: [LOGGER_TEST],
  },
  {
    symbol: 'backend/shared/src/context.ts#getContext',
    status: 'verified',
    summary: 'Reads the context of the request being handled, if there is one.',
    why: 'The logger calls it for every line (in its mixin) to add the request ID and user, without anyone passing them in.',
    returns: 'The current RequestContext, or undefined outside a request (for example at startup).',
    tests: [LOGGER_TEST],
  },
  {
    symbol: 'backend/shared/src/context.ts#setContextUserId',
    status: 'not-wired',
    summary: 'Adds the user ID to the current request context once the caller is known.',
    how: [
      'It reads the current context.',
      'If there is one, it sets `userId` on that same object.',
      'Outside a request it does nothing.',
    ],
    why: 'The user is only known after authentication, which runs after the request ID is set. Changing the existing object means every later log line in the request carries the user too. Only requireInternalToken calls it, and no app uses that yet.',
    sideEffects: ['Changes the current request context object.'],
    tests: [LOGGER_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/env.ts

  {
    symbol: 'backend/shared/src/env.ts#baseEnvSchema',
    status: 'verified',
    summary: 'The Zod schema for the variables every app reads: NODE_ENV and LOG_LEVEL.',
    why: 'Every app needs these two, so they are defined once. Each app extends this schema with its own variables: in its src/env.ts, or for auth in src/env-schema.ts.',
    returns:
      'A Zod object schema. NODE_ENV is development, test or production (default development). LOG_LEVEL is a pino level from fatal to trace, or silent (default info).',
    tests: [ENV_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#portSchema',
    status: 'verified',
    summary: 'A Zod schema for a TCP port, with a default.',
    how: [
      'It converts the value to a number, because environment variables are always text.',
      'It requires a whole number from 1 to 65,535.',
      'It uses `defaultPort` when the variable is not set.',
    ],
    why: 'Every app has a port, so the rule is written once. A bad value such as PORT=abc stops startup with a clear message. Each app passes its own default, from 8000 (gateway) to 8004 (billing).',
    returns: 'A Zod schema whose parsed value is a number.',
    tests: [ENV_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#EnvError',
    status: 'verified',
    summary: 'The error loadEnv throws when environment variables are missing or invalid.',
    why: 'It lists every problem in one message, so they can all be fixed in one go. The `problems` array keeps the list for code and tests to read.',
    tests: [ENV_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#EnvError.constructor',
    status: 'verified',
    summary: 'Builds the error message from the list of problems.',
    how: [
      'It writes "Invalid environment variables:" followed by one "  - problem" line per problem.',
      'It sets `name` to EnvError, so logs and stack traces show the right type.',
      'It stores the list in `problems`.',
    ],
    why: 'A readable list in the crash output says exactly which variables to fix.',
    tests: [ENV_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#loadEnv',
    status: 'verified',
    summary: 'Checks environment variables against a schema at startup and returns them typed.',
    how: [
      'It parses `source` (process.env by default) with `schema.safeParse`.',
      'If anything fails, it throws an EnvError with one "VARIABLE: message" line per problem.',
      'Otherwise it returns the parsed values, with defaults filled in and types converted.',
    ],
    why: 'A misconfigured app should refuse to start, instead of failing later on first use. Every problem is reported at once. Messages name the variable but not its value, so secrets cannot leak into logs.',
    returns: 'The parsed values, typed from the schema (for example PORT as a number).',
    sideEffects: ['Reads process.env when no source is passed.'],
    tests: [ENV_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/errors.ts

  {
    symbol: 'backend/shared/src/errors.ts#ERROR_CODES',
    status: 'verified',
    summary: 'Every error code the API can return, with its HTTP status and title.',
    why: 'Clients can check a stable code (like not_found) instead of parsing messages. AppError and toProblem look up the status and title here, so each is set in one place. The running apps raise only not_found, bad_request, payload_too_large, unsupported_media_type and internal_error. validation_failed, unauthorized and rate_limited come from validate, requireInternalToken, requireUser and rateLimit, which no app uses yet; no code outside the tests raises the other four.',
    returns: 'An object of 12 codes, from bad_request (400) to service_unavailable (503).',
    tests: [SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/errors.ts#AppError',
    status: 'verified',
    summary: 'An error that is safe to describe to the client, with an error code and HTTP status.',
    why: 'Code can throw an AppError anywhere and the error handler turns it into the right response. Any error that is not an AppError becomes a generic 500, so internal details never reach the client by accident.',
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST, RATE_LIMIT_TEST],
  },
  {
    symbol: 'backend/shared/src/errors.ts#AppError.constructor',
    status: 'verified',
    summary: 'Sets the code, status, message and optional field errors.',
    how: [
      "The message defaults to the code's title from ERROR_CODES.",
      'The status is looked up from ERROR_CODES.',
      '`cause` keeps the original error, for the logs.',
      '`fieldErrors` holds per-field problems, which validate() fills in.',
    ],
    why: 'It takes a code, not a status, so a code can never be paired with the wrong status.',
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST, RATE_LIMIT_TEST],
  },
  {
    symbol: 'backend/shared/src/errors.ts#toProblem',
    status: 'verified',
    summary: 'Turns an AppError into the JSON error body the API sends (RFC 9457 problem details).',
    how: [
      'It sets `type` to /errors/<code>, plus the title, status and code.',
      'It adds the message as `detail` only when the status is below 500.',
      'It adds the request ID and any field errors when there are some.',
    ],
    why: 'Every app answers errors in one standard shape. Server-side failures never describe themselves to the client; their details stay in the logs.',
    returns: 'A ProblemDetails object.',
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST, RATE_LIMIT_TEST, ...APP_TESTS],
  },
  {
    symbol: 'backend/shared/src/errors.ts#notFoundHandler',
    status: 'verified',
    summary: 'Middleware that turns a request no route matched into a 404 error.',
    how: [
      'createService adds it after every route, so it only runs when nothing else answered.',
      "It passes an AppError('not_found') naming the method and path to the error handler.",
    ],
    why: "Express's own 404 is an HTML page. Passing an AppError gives unknown routes the same problem+json body as every other error.",
    returns: 'An Express middleware function.',
    tests: [SERVICE_TEST, ...APP_TESTS],
  },
  {
    symbol: 'backend/shared/src/errors.ts#errorHandler',
    status: 'verified',
    summary: 'The last middleware in every app: turns any error into a problem+json response.',
    how: [
      "If a response has already started (for example a stream), it calls next(err). Express's final handler then destroys the socket and, unless Express's env setting (from NODE_ENV) is test, prints the error to stderr with console.error, bypassing pino and its redaction. No route streams a response today, so this path is not reached yet.",
      'It converts the error to an AppError with toAppError.',
      'For a status of 500 or more, it logs the original error.',
      'It answers with the status, the application/problem+json type and the body from toProblem, including the request ID.',
    ],
    why: 'All errors leave the API in one shape. Unexpected ones are logged in full but shown to the client only as a generic 500.',
    returns: 'An Express error-handling middleware function.',
    sideEffects: [
      'Writes a "request failed" error log line for 5xx errors.',
      'Sends the error response.',
    ],
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST, RATE_LIMIT_TEST, ...APP_TESTS],
  },
  {
    symbol: 'backend/shared/src/errors.ts#toAppError',
    status: 'verified',
    summary: 'Converts any thrown value into an AppError.',
    how: [
      'An AppError is returned unchanged.',
      'An error from the JSON body parser is recognised by its `type` field.',
      'entity.too.large becomes payload_too_large (413).',
      'entity.parse.failed becomes bad_request (400), "The request body is not valid JSON".',
      'charset.unsupported (a charset the parser cannot read, such as latin1) becomes unsupported_media_type (415), "The request body uses an unsupported charset".',
      'encoding.unsupported (a Content-Encoding the parser cannot decode, such as compress) becomes unsupported_media_type (415), "The request body uses an unsupported Content-Encoding".',
      'Anything else becomes internal_error (500), with the original kept as `cause`.',
    ],
    why: 'The error handler can then treat every error the same way. A body the parser cannot read is for the client to fix, so it gets a 4xx, not a server failure. The 415 messages are fixed, so the charset or Content-Encoding the client sent is never echoed back. Unknown errors become a 500, whose message is never shown to the client.',
    returns: 'An AppError.',
    tests: [SERVICE_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/health.ts

  {
    symbol: 'backend/shared/src/health.ts#CHECK_TIMEOUT_MS',
    status: 'verified',
    summary: 'How long each readiness check may take before it counts as failed.',
    why: 'A dependency that hangs should not make /readyz hang too. Checks run at the same time, so /readyz answers within about this long. No test waits for it to run out.',
    returns: '2,000 milliseconds (2 seconds).',
  },
  {
    symbol: 'backend/shared/src/health.ts#HEALTH_PATHS',
    status: 'verified',
    summary: 'The two paths healthRouter serves: /healthz and /readyz.',
    why: 'isHealthProbe looks a request path up in it to decide whether the request logger skips the request. healthRouter writes its two paths out itself and does not read the set, so the two have to be kept in step by hand.',
    returns: "A Set of the strings '/healthz' and '/readyz'.",
    tests: [SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/health.ts#isHealthProbe',
    status: 'verified',
    summary: 'Says whether a request is a health probe, so the request logger can skip it.',
    how: [
      'It returns false for any method other than GET or HEAD.',
      'It drops the query string from the URL, because the router serves /healthz?probe=1 too.',
      'It returns true when the path that is left is in HEALTH_PATHS.',
    ],
    why: 'Probes are meant to come every few seconds, and logging each one would bury the real requests. Anything else on those paths, such as POST /healthz, is a mistake worth seeing, so it is still logged. createService passes it to pino-http as `autoLogging.ignore` in every app. It is passed, not called, so the generated index lists no callers.',
    returns:
      'true for a GET or HEAD of /healthz or /readyz, with or without a query string; false otherwise.',
    tests: [SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/health.ts#healthRouter',
    status: 'verified',
    summary: 'Adds the /healthz and /readyz endpoints to an app.',
    how: [
      "GET /healthz always answers 200 with { status: 'ok', service }.",
      'GET /readyz runs every readiness check at the same time, each with a 2-second limit.',
      'Each check is recorded as ok or failed; a failure is logged as a warning.',
      'It answers 200 "ready" if every check passed (or there are none), otherwise 503 "not_ready", with the result of each check.',
    ],
    why: '/healthz says the process is up; it is meant to be used to restart a stuck app. /readyz says its dependencies answer; it is meant to decide whether to send the app traffic. Nothing outside the tests reads either yet: backend/docker-compose.yml runs only MongoDB, Redis and Qdrant, with no health checks for the apps. Failure reasons go to the logs only, so internal addresses are not exposed.',
    returns: 'An Express Router.',
    sideEffects: ['Logs a "readiness check failed" warning for each failed check.'],
    tests: [SERVICE_TEST, ...APP_TESTS],
  },
  {
    symbol: 'backend/shared/src/health.ts#withTimeout',
    status: 'verified',
    summary: 'Rejects if a promise does not settle within a time limit.',
    how: [
      'It starts a timer that rejects with "timed out after <ms>ms".',
      'It races the promise against the timer.',
      'It clears the timer when either one finishes.',
    ],
    why: 'Without it, one dependency that hangs (instead of failing) would make /readyz hang. It only stops waiting: the slow work itself keeps running. The tests run it on every /readyz call, but no test makes a check time out.',
    returns: 'A promise with the original result, or a rejection after `ms` milliseconds.',
    tests: [SERVICE_TEST, ...APP_TESTS],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/internalToken.ts

  {
    symbol: 'backend/shared/src/internalToken.ts#INTERNAL_TOKEN_HEADER',
    status: 'not-wired',
    summary: 'The name of the header that carries the internal token.',
    why: 'The gateway and the services must agree on the header name, so it is defined once. The logger separately redacts this header, so tokens never reach the logs. Only requireInternalToken reads it, and no app uses that yet.',
    returns: "The string 'x-internal-token'.",
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#ISSUER',
    status: 'not-wired',
    summary: 'The issuer written into, and required on, every internal token.',
    why: 'signInternalToken writes it into every token and verifyInternalToken rejects a token with any other issuer. The name says the gateway is the one that signs them.',
    returns: "The string 'gilder-gateway'.",
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#ALGORITHM',
    status: 'not-wired',
    summary: 'The one signing algorithm internal tokens use.',
    why: 'Keys are imported for it, tokens are signed with it, and verification accepts only it. Fixing one algorithm means a token cannot choose a different one.',
    returns: "The string 'EdDSA'.",
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#importInternalPrivateKey',
    status: 'not-wired',
    summary: 'Turns a private key in PEM text into a key object that can sign internal tokens.',
    why: 'Keys are kept as PEM text, for example in .env files, but jose signs with a key object. It always imports the key for EdDSA. No app imports a key yet.',
    returns: 'A promise of the key object (InternalKey).',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#importInternalPublicKey',
    status: 'not-wired',
    summary: 'Turns a public key in PEM text into a key object that can verify internal tokens.',
    why: 'Services only need the public key: it can check a token but cannot make one. It always imports the key for EdDSA. No app imports a key yet: auth requires INTERNAL_PUBLIC_KEY at startup but does not import it.',
    returns: 'A promise of the key object (InternalKey).',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#generateInternalKeyPair',
    status: 'verified',
    summary: 'Creates a new EdDSA key pair and returns both keys as PEM text.',
    how: [
      'It generates the pair with jose, marked extractable so it can be exported.',
      'It exports the private key as PKCS8 PEM and the public key as SPKI PEM.',
    ],
    why: 'Its comment says it is for .env files and tests. The private key signs tokens and the public key checks them. The `pnpm setup:keys` script (backend/shared/scripts/setup-keys.ts) calls it when the gateway has no signing key yet, or with --rotate; the tests call it too.',
    returns: 'A promise of { privateKey, publicKey }, both PEM strings.',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#signInternalToken',
    status: 'not-wired',
    summary:
      'Signs a short-lived token that proves a forwarded request came through the gateway, and names its user when there is one.',
    how: [
      'The subject (`sub`) is the user ID, set only when a user ID is given. A token for a request with no session, such as a sign-in, has no `sub`.',
      'The request ID, when given, goes in a `rid` claim.',
      'The issuer is gilder-gateway and the audience is the service the token is for.',
      'It expires after `ttlSeconds` (60 by default) and is signed with EdDSA.',
    ],
    why: 'Services never trust a plain user-ID header, because anything that can reach a service could claim to be any user. So services accept only a signed token addressed to them. A token without a user still proves the request came through the gateway, so no service route has to be open to direct calls. The audience stops a token for one service being used against another, and the short life limits the harm if one leaks. No app signs tokens yet.',
    returns: 'A promise of the signed token, a JWT string.',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#verifyInternalToken',
    status: 'not-wired',
    summary: 'Checks an internal token and reads the user and request ID from it, when present.',
    how: [
      'jose checks the signature, the issuer, the audience and the expiry, and accepts only EdDSA.',
      '`currentDate` lets tests pretend time has passed.',
      'It returns `userId` only when `sub` is a non-empty string, and `requestId` only when the `rid` claim is a string.',
      'A valid token with no subject is accepted; the result just has no `userId`.',
    ],
    why: 'A service must reject a token that is missing, forged, expired or addressed to another service. Whether a route needs a user is a separate check, requireUser. Only requireInternalToken calls it, and no app uses that yet.',
    returns:
      'A promise of { userId?, requestId? }, an empty object for a valid token with neither. It rejects when any check fails.',
    tests: [INTERNAL_TOKEN_TEST, SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#requireInternalToken',
    status: 'not-wired',
    summary: 'Middleware for services: lets a request through only with a valid internal token.',
    how: [
      'It reads the x-internal-token header.',
      "A missing header throws AppError('unauthorized', 'Missing internal token').",
      "A token that fails verifyInternalToken throws AppError('unauthorized', 'Invalid internal token'), keeping the original error as `cause`.",
      'When the token names a user, it stores the user ID in `res.locals.userId` and in the request context.',
      'A valid token with no user passes too, with no user set. It does not require one: routes that act for a user add requireUser() after it.',
      'Express 5 passes errors thrown in async middleware to the error handler, which answers 401.',
    ],
    why: 'It is how a service will know that a request really came through the gateway, and which user it is for. A direct call without a valid token gets 401. With the `internalAuth` option, createService puts it in front of every route except /healthz and /readyz; no app passes that option yet.',
    returns: 'An async Express middleware function.',
    sideEffects: [
      'Sets res.locals.userId when the token names a user.',
      'Adds that user ID to the request context, so later log lines carry it.',
    ],
    tests: [INTERNAL_TOKEN_TEST, SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#requireUser',
    status: 'not-wired',
    summary:
      'Middleware for routes that act for a user: answers 401 unless the internal token named one.',
    how: [
      'It runs after requireInternalToken, which sets `res.locals.userId` only when the token has a user.',
      "Without `res.locals.userId`, it passes AppError('unauthorized', 'This route needs a signed-in user') to the error handler, which answers 401.",
      'Otherwise it calls next().',
    ],
    why: 'A valid internal token only proves that a request came through the gateway; requests with no session, such as a sign-in, carry one too. Routes that must know the user add this check on top. No app uses it yet.',
    returns: 'An Express middleware function.',
    tests: [INTERNAL_TOKEN_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/logger.ts

  {
    symbol: 'backend/shared/src/logger.ts#REDACTED_PATHS',
    status: 'verified',
    summary: 'The log fields that pino replaces with "[REDACTED]".',
    why: 'Passwords, tokens, cookies and API keys must never be written to logs, even by accident. Listing them once means every app hides the same fields.',
    returns:
      'An array of pino redact paths: the Authorization, Cookie and x-internal-token request headers, the Set-Cookie response header, and the keys password, token, idToken, apiKey, secret and signature, both at the top level and one level down (for example user.token).',
    tests: [LOGGER_TEST],
  },
  {
    symbol: 'backend/shared/src/logger.ts#createLogger',
    status: 'verified',
    summary: 'Creates the JSON logger every app uses.',
    how: [
      'Every line gets the service name, an ISO timestamp and the level as a word (like "info") instead of a number.',
      'Fields in REDACTED_PATHS are replaced with "[REDACTED]".',
      'A mixin adds the request ID, and the user ID once known, from the request context.',
      'With `destination` it writes there; the tests use this to read the output.',
      'With `pretty` it writes colored, human-readable lines through pino-pretty.',
      'Otherwise it writes JSON lines to stdout.',
    ],
    why: 'One logger setup keeps the logs of all apps in the same shape, so they can be searched together and followed by request ID. Each app turns on pretty output only when NODE_ENV is development.',
    returns: 'A pino Logger.',
    sideEffects: ['Writes log lines to stdout, or to the given destination.'],
    tests: [LOGGER_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/mongo.ts

  {
    symbol: 'backend/shared/src/mongo.ts#connectMongo',
    status: 'verified',
    summary: 'Connects Mongoose to MongoDB and waits until the connection works.',
    how: [
      "It turns on Mongoose's strictQuery option.",
      'It connects, giving up if no server answers within 5 seconds.',
      'It logs the database name once connected.',
    ],
    why: 'An app should never start serving requests without its database, so auth, chat, agent and billing await it before they build the app. The URI is never logged, because it can contain a password.',
    returns: 'A promise that resolves once connected, or rejects if the connection fails.',
    sideEffects: [
      'Opens the shared Mongoose connection for the whole process.',
      'Sets the strictQuery option for the whole process.',
      'Logs "mongodb connected" with the database name.',
    ],
    tests: [MONGO_TEST],
  },
  {
    symbol: 'backend/shared/src/mongo.ts#disconnectMongo',
    status: 'verified',
    summary: 'Closes the Mongoose connection.',
    why: 'Each service with a database calls it from its onShutdown hook, after the server stops taking requests, so the connection closes cleanly.',
    returns: 'A promise that resolves once disconnected.',
    sideEffects: ['Closes the MongoDB connections Mongoose opened.'],
    tests: [MONGO_TEST],
  },
  {
    symbol: 'backend/shared/src/mongo.ts#pingMongo',
    status: 'verified',
    summary: 'Readiness check: passes only if MongoDB is connected and answers a ping.',
    how: [
      'It fails straight away unless the connection state is connected.',
      'It then sends a ping command to the server.',
    ],
    why: 'A connection can drop after startup. auth, chat, agent and billing pass it to /readyz as their mongo check, which is meant to stop traffic going to a service whose database is gone (nothing reads /readyz yet). It is passed, not called, so the generated index lists no callers.',
    returns: 'A promise that resolves on success and rejects otherwise.',
    tests: [MONGO_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/rateLimit.ts

  {
    symbol: 'backend/shared/src/rateLimit.ts#hitRateLimit',
    status: 'not-wired',
    summary: 'Counts one request for a caller in Redis and says whether it is within the limit.',
    how: [
      'The Redis key is rl:<scope>:<id>, so each scope and each caller has its own count.',
      'One MULTI transaction increments the count, starts the expiry with EXPIRE ... NX (only if none is running) and reads the time left with TTL.',
      'It throws if the transaction is aborted or any of its three commands fails.',
      'The request is allowed while the count is at most `limit`.',
      'The window lasts `windowSeconds` (60 by default) from the first request. Later requests do not extend it, and the count starts over when the key expires.',
    ],
    why: 'Counting in Redis means every copy of an app shares the same counts. The count and its expiry are set in one transaction, so a counter is never left behind without an expiry. EXPIRE with NX needs Redis 7 or later; backend/docker-compose.yml and CI run redis:7-alpine. Only rateLimit calls it, and no app uses that yet.',
    returns:
      'A promise of { allowed, remaining, retryAfterSeconds }. `remaining` never goes below 0. `retryAfterSeconds` is the time left in the window, or `windowSeconds` when TTL gives no positive value.',
    sideEffects: ['Increments a counter in Redis, and sets its expiry when the window starts.'],
    tests: [RATE_LIMIT_TEST],
  },
  {
    symbol: 'backend/shared/src/rateLimit.ts#rateLimit',
    status: 'not-wired',
    summary: 'Middleware that answers 429 once a caller has used up its limit.',
    how: [
      '`keyOf` picks what is counted, such as the IP address or the signed-in user.',
      'When `keyOf` returns undefined, the request is not counted and goes on.',
      'Otherwise it counts the request with hitRateLimit.',
      "Over the limit, it sets the Retry-After header to the seconds left in the window and throws AppError('rate_limited'), whose message says when to try again.",
      'Express 5 passes errors thrown in async middleware to the error handler, which answers 429.',
      'If the Redis call fails, that error reaches the error handler too, which answers 500: the request is refused, not let through.',
    ],
    why: 'It puts a limit in front of routes in one line, with the counts shared through Redis. Retry-After tells a well-behaved client how long to wait. No app adds it to a route yet.',
    returns: 'An async Express middleware function.',
    sideEffects: ['Counts the request in Redis.', 'Sets the Retry-After header on a 429.'],
    tests: [RATE_LIMIT_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/redis.ts

  {
    symbol: 'backend/shared/src/redis.ts#createRedis',
    status: 'verified',
    summary: "Creates a Redis client whose errors go to the app's logger.",
    how: [
      'It creates an ioredis client for the URL, which starts connecting straight away.',
      'It listens for `error` events and logs each one as "redis error", a pino log line like every other (JSON, or pretty-printed in development).',
      'It sets maxRetriesPerRequest to 2 (the ioredis default is 20). In ioredis this counter belongs to the whole client, not to each command.',
      'While Redis is down, commands wait in a queue. ioredis rejects the whole queue with MaxRetriesPerRequestError on every third failed reconnect (maxRetriesPerRequest + 1).',
      'Reconnect delays grow to at most 5 seconds, so a queued command waits at most about 15 seconds. With the default of 20 it would be about 100 seconds.',
    ],
    why: 'Without an `error` listener, ioredis would not crash: it would print "[ioredis] Unhandled error event" and the stack with console.error, outside the structured logs. With the listener these errors go to the pino logger at level error instead. A request that needs Redis gets an error after about 15 seconds at most, instead of hanging for minutes. The client keeps reconnecting meanwhile, and /readyz reports Redis as failed. The gateway, auth and agent use it.',
    returns: 'The ioredis client.',
    sideEffects: [
      'Opens a connection to Redis.',
      'Logs "redis error" each time the client reports an error.',
    ],
  },
  {
    symbol: 'backend/shared/src/redis.ts#pingRedis',
    status: 'verified',
    summary: 'Readiness check: passes only if Redis answers PING with PONG.',
    why: 'The gateway, auth and agent use it as their redis check in /readyz, which is meant to stop traffic going to them while Redis is unreachable (nothing reads /readyz yet).',
    returns: 'A promise that resolves on PONG and rejects otherwise.',
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/requestId.ts

  {
    symbol: 'backend/shared/src/requestId.ts#REQUEST_ID_HEADER',
    status: 'verified',
    summary: 'The header that carries the request ID.',
    why: 'The requestId middleware reads and writes it, and createService tells pino-http to read the ID from it, so both agree on the name.',
    returns: "The string 'x-request-id'.",
    tests: [SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/requestId.ts#SAFE_REQUEST_ID',
    status: 'verified',
    summary: 'The pattern an incoming request ID must match to be reused.',
    why: 'Request IDs go into every log line written during a request and back into the response header. The pattern limits how long an incoming ID can be and which characters it may contain; any other value is replaced with a new random UUID.',
    returns: 'A regular expression for 8 to 128 letters, digits, underscores, dots or hyphens.',
    tests: [SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/requestId.ts#requestId',
    status: 'verified',
    summary:
      'Middleware that gives every request an ID, echoes it back and makes it available to logs.',
    how: [
      'It reads the incoming X-Request-Id header.',
      'It keeps that value only if it matches SAFE_REQUEST_ID; otherwise it makes a new random UUID.',
      'It stores the ID in res.locals.requestId and sets it on the response header.',
      'It runs the rest of the request inside runWithContext, so every log line written during the request carries the ID.',
    ],
    why: "Reusing the caller's ID lets one ID follow a request through the frontend, the gateway and every service. Error responses include it too. createService installs it first in every app.",
    returns: 'An Express middleware function.',
    sideEffects: ['Sets the X-Request-Id response header.', 'Sets res.locals.requestId.'],
    tests: [SERVICE_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/service.ts

  {
    symbol: 'backend/shared/src/service.ts#createService',
    status: 'verified',
    summary: 'Builds an Express app with the shared middleware in the right order.',
    how: [
      'It turns off the X-Powered-By header.',
      'requestId() gives the request its ID.',
      'pino-http logs each request with that ID. isHealthProbe makes it skip GET and HEAD probes of /healthz and /readyz; anything else on those paths is logged.',
      'The log level follows the result: error for failures and 5xx, warn for 4xx, info otherwise.',
      'helmet() sets security headers.',
      'When `parseJson` is true (the default), express.json() parses JSON bodies up to `bodyLimit` (64kb by default). When it is false, bodies are left unread, byte for byte.',
      'healthRouter() adds /healthz and /readyz.',
      'When the `internalAuth` option is given, requireInternalToken() comes next. Every route except /healthz and /readyz then needs a valid internal token addressed to this service, so a direct call gets 401 on any path, even an unknown one, unless its JSON body is rejected first: the body parser runs before the token check.',
      "The app's own `routes` come next.",
      'notFoundHandler() and errorHandler() come last, to catch whatever is left.',
    ],
    why: 'Middleware order matters: the request ID must exist before anything logs, health probes must not need a token, and the error handler must come last. The token check runs before the routes, so a call without a token cannot learn from a 404 which paths exist. Writing the order once means all five apps get it right. Per its comment, the gateway is meant to turn `parseJson` off so it can forward bodies to the services untouched. No app turns it off or passes `internalAuth` yet.',
    returns: 'The Express app, not listening yet.',
    sideEffects: [
      'For each request once the app listens: sets security headers and X-Request-Id, and writes a request log line (not for GET or HEAD health probes).',
    ],
    tests: [SERVICE_TEST, ...APP_TESTS],
  },
  {
    symbol: 'backend/shared/src/service.ts#startService',
    status: 'verified',
    summary: 'Starts the server on a port and sets up graceful shutdown.',
    how: [
      'It calls app.listen and rejects if the port cannot be opened.',
      'Once listening, it logs the port and resolves with { port, close }.',
      'close() stops new connections, closes idle ones and lets in-flight requests finish.',
      'While shutting down, it closes each keep-alive connection as soon as its last response is sent, instead of leaving it idle for about 6 seconds.',
      'After `shutdownTimeoutMs` (10 seconds by default) it force-closes any connection still open.',
      'Then it runs `onShutdown` (where apps close their databases) and logs "shut down cleanly".',
      'Calling close() again returns the same promise.',
      'Unless `handleSignals` is false, the first SIGTERM or SIGINT runs close(), then exits with code 0, or logs "shutdown failed" and exits with code 1. Later signals are logged as "already shutting down" and ignored.',
      'If a shutdown started by a signal is still running `CLEANUP_GRACE_MS` (5 seconds) after the force-close, it logs "shutdown timed out" and exits with code 1.',
    ],
    why: 'Stopping abruptly would cut requests off halfway. This lets running requests finish, with a time limit so one stuck connection cannot block shutdown forever. Tests turn signals off and call close() themselves.',
    returns:
      'A promise of { port, close }. `port` is the real port, which matters when port 0 asks the system for a free one.',
    sideEffects: [
      'Opens a listening port.',
      'Logs "listening" once open, "shutting down" on the first signal, "already shutting down" on any later one and "shut down cleanly" after close() finishes.',
      'Adds one SIGTERM and SIGINT listener to the process, which stays registered.',
      'Exits the process after a shutdown started by a signal.',
    ],
    tests: [SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/service.ts#CLEANUP_GRACE_MS',
    status: 'verified',
    summary:
      'How long a shutdown started by a signal may keep cleaning up after open connections are cut.',
    why: 'On the first SIGTERM or SIGINT, startService sets a backstop timer for `shutdownTimeoutMs` plus this long (15 seconds with the default timeout). If close() has not finished by then, for example because onShutdown hangs on a database, it logs "shutdown timed out" and exits with code 1. So a stuck cleanup cannot keep the process alive forever. Every app starts with signals handled, so every app has the backstop. No test waits for it to run out.',
    returns: '5,000 milliseconds (5 seconds).',
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/sessions.ts

  {
    symbol: 'backend/shared/src/sessions.ts#SESSION_COOKIE',
    status: 'not-wired',
    summary: 'The name of the cookie that carries the session ID.',
    why: "The app that sets the cookie and the app that reads it must agree on the name, so it is defined once. The logger redacts the Cookie and Set-Cookie headers, so the session ID never reaches the logs. sessionIdFromCookies and auth's sign-in routes use it.",
    returns: "The string 'gilder_sid'.",
  },
  {
    symbol: 'backend/shared/src/sessions.ts#SESSION_TTL_SECONDS',
    status: 'not-wired',
    summary: 'How long a session lasts after it was last used.',
    why: 'createSession sets this expiry and resolveSession restarts it on every lookup, so a session in use stays alive and an unused one ends by itself. backend/docker-compose.yml runs Redis with noeviction, so Redis never drops a session to free memory; its comment says every key has an expiry instead. No app creates sessions yet.',
    returns: '604,800 seconds (7 days).',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#SESSION_ID_BYTES',
    status: 'not-wired',
    summary: 'How many random bytes make up a session ID.',
    why: 'Per its comment, 32 random bytes give too many possibilities to guess. As base64url they make a 43-character ID of letters, digits, hyphens and underscores. Only createSession reads it.',
    returns: 'The number 32.',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#SESSION_ID_FORMAT',
    status: 'not-wired',
    summary: 'The shape every real session ID has: 43 base64url characters.',
    why: 'The session ID comes from a cookie, which the caller controls. resolveSession and deleteSession check it against this pattern first and stop when it does not match, so a malformed value never reaches Redis.',
    returns: 'A regular expression for exactly 43 letters, digits, underscores or hyphens.',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#sessionKey',
    status: 'not-wired',
    summary:
      'The Redis key a session is stored under: sess: followed by the SHA-256 hash of its ID.',
    why: 'Redis never holds the session ID itself, so someone who reads a Redis dump sees no IDs they could put in a cookie. The same ID always gives the same key, so a lookup is a single read. createSession, resolveSession and deleteSession all use it.',
    returns: 'A string like sess:<64 hex characters>.',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#createSession',
    status: 'not-wired',
    summary: 'Starts a session for a user and returns its ID, the value for the session cookie.',
    how: [
      'It makes a new ID from 32 random bytes, as base64url.',
      'It stores { userId } as JSON under sessionKey(ID), with SET ... EX so it expires after 7 days.',
      'It returns the ID; only its hash is in Redis.',
    ],
    why: 'Sessions live in Redis, so any copy of any app can read them. Per the file comment, auth creates and deletes sessions and the gateway looks them up on every request; no app does either yet. Each call makes a new session, so one user can be signed in on several devices at once.',
    returns: 'A promise of the session ID, a 43-character string.',
    sideEffects: ['Writes one key to Redis, with a 7-day expiry.'],
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#resolveSession',
    status: 'not-wired',
    summary: 'Finds the session for an ID from a cookie and restarts its 7 days.',
    how: [
      'It returns undefined straight away when the ID does not match SESSION_ID_FORMAT.',
      'GETEX reads the session and sets its expiry back to 7 days in one round trip.',
      'A missing or expired key gives undefined.',
      'Otherwise parseSession checks the stored value.',
    ],
    why: 'The cookie is input from the caller, so nothing about it is assumed: a malformed ID, an unknown or expired session and a damaged stored value all mean "no session". Restarting the expiry on each lookup means a session ends 7 days after it was last used, not 7 days after it was made. No app calls it yet.',
    returns: 'A promise of { userId }, or undefined when there is no valid session.',
    sideEffects: ["Resets the session's expiry in Redis to 7 days."],
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#deleteSession',
    status: 'not-wired',
    summary: 'Ends one session (logout).',
    how: [
      'An ID that does not match SESSION_ID_FORMAT is ignored.',
      'Otherwise it deletes the key from sessionKey(ID).',
      'An unknown or already deleted session is not an error: it resolves either way.',
    ],
    why: 'Only that session ends, so the user stays signed in on their other devices. Logging out twice, or after the session expired, does no harm. No app calls it yet.',
    returns: 'A promise that resolves once done.',
    sideEffects: ['Deletes the session key from Redis.'],
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#sessionIdFromCookies',
    status: 'not-wired',
    summary: "Reads the session ID from a request's Cookie header.",
    how: [
      "The cookie package's parseCookie splits the header into name and value pairs.",
      'It returns the SESSION_COOKIE value, or undefined when there is no header, no session cookie or an empty one.',
    ],
    why: "Auth's logout route reads the session it must end this way, and the gateway will read sessions the same way, so both parse the cookie identically. The value is still untrusted: resolveSession and deleteSession check its shape before using it. No running app calls it yet.",
    returns: 'The session ID string, or undefined.',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#parseSession',
    status: 'not-wired',
    summary: 'Reads a stored session value, accepting only JSON with a non-empty string userId.',
    how: [
      'It parses the value as JSON; text that is not JSON gives undefined.',
      'It requires an object whose `userId` is a non-empty string.',
      'It returns a new { userId } with only that field, dropping anything else.',
    ],
    why: 'A value in Redis could be damaged or written by something else. Treating anything unexpected as no session means a bad value never produces a session without a user. Only resolveSession calls it.',
    returns: '{ userId }, or undefined.',
    tests: [SESSIONS_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/test-redis.ts

  {
    symbol: 'backend/shared/src/test-redis.ts#TEST_REDIS_URL',
    status: 'verified',
    summary: 'Where the tests find Redis.',
    why: 'For tests only. The tests use a real Redis: the local container from `pnpm infra:up` on port 6380, and in CI a Redis service on the same port. Database 15 keeps test keys away from the development data in database 0. The TEST_REDIS_URL environment variable overrides it.',
    returns: "process.env.TEST_REDIS_URL when set, otherwise 'redis://localhost:6380/15'.",
  },
  {
    symbol: 'backend/shared/src/test-redis.ts#createTestRedis',
    status: 'verified',
    summary: 'Gives one test its own Redis client, whose keys no other test can see.',
    how: [
      'It makes a random prefix, test:<uuid>:, and ioredis adds it to every key the client writes.',
      'It connects before returning and never retries, so a test fails straight away when Redis is not running, with a message saying to run `pnpm infra:up`.',
      "`keys()` lists this test's keys with SCAN, without the prefix. SCAN takes a pattern, which ioredis does not prefix, so the pattern names the prefix itself.",
      "`cleanup()` deletes this test's keys and closes the connection.",
    ],
    why: "For tests only: sessions.test.ts and rateLimit.test.ts make one before each test and clean it up after. Tests running at the same time, even in other packages, never see each other's keys, and cleanup deletes only this test's keys.",
    returns: 'A promise of { redis, keys, cleanup }.',
    sideEffects: ['Opens a connection to the test Redis.'],
    tests: [SESSIONS_TEST, RATE_LIMIT_TEST],
  },
  {
    symbol: 'backend/shared/src/test-mongo.ts#startTestMongo',
    status: 'verified',
    summary: 'Starts a real MongoDB for one test file and connects Mongoose to it.',
    how: [
      'mongodb-memory-server downloads a mongod binary on first use and starts it as a single server, so no Docker is needed.',
      'connectMongo connects the shared Mongoose to its gilder_test database, with a silent logger.',
      '`stop()` disconnects Mongoose and stops the server.',
    ],
    why: "For tests only: an app's tests import it from `@gilder/shared/testing`, a separate entry that the running apps never load. Each call starts its own server, so test files running at the same time never share data. auth's users.test.ts uses it.",
    returns: 'A promise of { stop }.',
    sideEffects: ['Starts a mongod process and connects Mongoose to it.'],
    tests: [AUTH_USERS_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/validate.ts

  {
    symbol: 'backend/shared/src/validate.ts#validate',
    status: 'not-wired',
    summary: "Middleware that checks a request's params, query and body with Zod schemas.",
    how: [
      'It parses each part that has a schema.',
      'It collects every problem, with paths like body.name.',
      "If there are any, it passes one AppError('validation_failed') holding all of them to the error handler, which answers 400.",
      'Otherwise it replaces each part with the parsed value, so handlers get typed, converted data (for example the number 5, not the text "5").',
      'It redefines req.query instead of assigning it, because Express 5 exposes req.query through a getter.',
    ],
    why: 'Handlers can trust their input, and clients learn about every bad field in one response instead of one at a time. No app has routes that use it yet.',
    returns: 'An Express middleware function.',
    sideEffects: ['Replaces req.params, req.query and req.body with the parsed values.'],
    tests: [SERVICE_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // The five apps: createApp and env

  {
    symbol: 'backend/gateway/src/app.ts#createApp',
    status: 'verified',
    summary: "Builds the gateway's Express app.",
    how: [
      "It calls createService with the name 'gateway' and the given logger and readiness checks.",
      'It adds no routes of its own yet; its comment says createService already serves /healthz and /readyz.',
      'At startup, index.ts passes one readiness check: redis.',
    ],
    why: 'Building the app apart from starting it lets tests get the app without startService, a fixed port or real databases; supertest serves it on a temporary port. The logger and checks are passed in, so tests can use a silent logger and fake checks.',
    returns: 'An Express app with /healthz, /readyz and the shared 404 and error handling.',
    tests: [GATEWAY_TEST],
  },
  {
    symbol: 'backend/gateway/src/env.ts#env',
    status: 'verified',
    summary: "The gateway's environment variables, checked at startup.",
    how: [
      'It extends baseEnvSchema with PORT (default 8000) and REDIS_URL (required, not empty).',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The gateway refuses to start if REDIS_URL is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the Redis URL and the port.',
    returns: 'An object with NODE_ENV, LOG_LEVEL, PORT (a number) and REDIS_URL.',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/services/auth/src/app.ts#createApp',
    status: 'verified',
    summary: "Builds the auth service's Express app.",
    how: [
      "It calls createService with the name 'auth' and the given logger and readiness checks.",
      'It adds no routes of its own yet; its comment says createService already serves /healthz and /readyz.',
      'At startup, index.ts passes two readiness checks: mongo and redis.',
    ],
    why: 'Building the app apart from starting it lets tests get the app without startService, a fixed port or real databases; supertest serves it on a temporary port. The logger and checks are passed in, so tests can use a silent logger and fake checks.',
    returns: 'An Express app with /healthz, /readyz and the shared 404 and error handling.',
    tests: [AUTH_TEST],
  },
  {
    symbol: 'backend/services/auth/src/env.ts#env',
    status: 'verified',
    summary: "The auth service's environment variables, checked at startup.",
    how: [
      'It is one line, `loadEnv(authEnvSchema)`: the settings and the rules between them live in env-schema.ts.',
      'loadEnv checks process.env against that schema when the file is first imported.',
    ],
    why: 'The service refuses to start if a setting is missing or invalid, before it connects to anything. It needs MONGODB_URI, REDIS_URL and INTERNAL_PUBLIC_KEY. AUTH_DEV_LOGIN (default false) and the three Firebase settings for Google sign-in are optional, except that production needs AUTH_DEV_LOGIN off and all three Firebase settings. PORT, NODE_ENV and LOG_LEVEL have defaults. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB and Redis URLs and the port; nothing reads INTERNAL_PUBLIC_KEY, AUTH_DEV_LOGIN or the Firebase settings yet.',
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY, AUTH_DEV_LOGIN (a boolean), and FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (each a string or undefined).',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/services/auth/src/env-schema.ts#authEnvSchema',
    status: 'verified',
    summary: "The auth service's settings and the rules between them, as a Zod schema.",
    how: [
      'It extends baseEnvSchema with PORT (default 8001), MONGODB_URI and REDIS_URL (both required, not empty).',
      "INTERNAL_PUBLIC_KEY, the gateway's public key for checking internal tokens, is required and must start with -----BEGIN PUBLIC KEY-----. Both of its messages say to run `pnpm setup:keys`, and neither repeats the value.",
      'AUTH_DEV_LOGIN, sign-in with just an email for local development and tests, is a true or false flag (default false). Zod\'s stringbool also takes 1/0, yes/no, on/off, y/n and enabled/disabled, in any case; any other value, including an empty one, fails with "must be true or false".',
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, a service account of a Firebase project for Google sign-in, may be left out; empty counts as unset. Escaped `\\n` line breaks in FIREBASE_PRIVATE_KEY are turned back into real ones, so the key works with or without double quotes in .env.',
      'In production, AUTH_DEV_LOGIN must be false, because it lets anyone sign in as anyone.',
      'In production, all three Firebase settings are required. Elsewhere they may all be left out, but setting only some of them is an error for each one missing.',
      'The rules between settings are skipped when a setting is missing or unreadable (unset, a PORT that is not a number, or a bad AUTH_DEV_LOGIN), so a missing MONGODB_URI is reported alone and the production rules only on the next start. A setting that is present but fails a check, such as an empty MONGODB_URI or a key without the PEM header, is reported together with them.',
    ],
    why: 'The rules stop the service from starting in a state that is unsafe (dev sign-in in production) or half set up (part of a service account). The schema lives apart from env.ts, which loads it at startup, so tests can check the rules without a real environment.',
    returns: 'A Zod object schema, with a superRefine for the production and Firebase rules.',
    tests: [AUTH_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/services/auth/src/env-schema.ts#optionalSetting',
    status: 'verified',
    summary: 'A Zod schema for a setting that may be left out, where empty counts as unset.',
    how: [
      'It trims the value.',
      'An empty result becomes undefined, the same as a variable that is not set.',
    ],
    why: 'A fresh copy of .env.example has the Firebase settings present but empty. Without this, FIREBASE_PROJECT_ID= would count as set and trip the all-or-none rule. The three Firebase settings use it.',
    returns: 'A Zod schema whose parsed value is the trimmed string, or undefined.',
    tests: [AUTH_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/services/auth/src/env-schema.ts#FIREBASE_SETTINGS',
    status: 'verified',
    summary: 'The names of the three Firebase settings that Google sign-in needs.',
    why: 'The production and all-or-none rules in authEnvSchema go through this list to find the missing ones, so each missing setting gets its own message. `as const` keeps the exact names, so they can be used to read the parsed settings.',
    returns:
      'A read-only array: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
    tests: [AUTH_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/services/auth/src/firebase.ts#REJECTED_TOKEN_CODES',
    status: 'not-wired',
    summary: 'The Firebase error codes that mean the sign-in token itself is no good.',
    why: "auth/argument-error, auth/invalid-id-token, auth/id-token-expired, auth/id-token-revoked, auth/user-disabled and auth/user-not-found all mean the user has to sign in again, so they become a 401. Any other failure, such as a wrong service account or Firebase being unreachable, is the server's problem and stays a 500, so users are never blamed for an outage.",
    returns: 'A Set of six error codes.',
    tests: [AUTH_FIREBASE_TEST],
  },
  {
    symbol: 'backend/services/auth/src/firebase.ts#verifierFrom',
    status: 'not-wired',
    summary: 'Checks a Google sign-in ID token and returns who signed in.',
    how: [
      'It calls verifyIdToken(token, true): `true` also asks Firebase whether the token was revoked, for example after the account was disabled.',
      "A FirebaseAuthError whose code is in REJECTED_TOKEN_CODES becomes AppError('unauthorized'), 'The Google sign-in is not valid. Sign in again.', with Firebase's error as its cause. Any other error is thrown again unchanged.",
      "The token must carry an email with email_verified true; otherwise it is a 401, 'The Google account has no verified email address'.",
      'It returns firebaseUid and email, plus name and avatarUrl when the account has them.',
    ],
    why: 'The browser sends the token it got from Firebase, so auth must check it before trusting who the user is. It takes the checker as an argument, so tests can pass a fake. No route uses it yet.',
    returns:
      'A function from an ID token to a promise of { firebaseUid, email, name?, avatarUrl? }.',
    tests: [AUTH_FIREBASE_TEST],
  },
  {
    symbol: 'backend/services/auth/src/firebase.ts#createFirebaseVerifier',
    status: 'not-wired',
    summary: 'Builds the real token check from a Firebase service account.',
    how: [
      "It starts a firebase-admin app named 'gilder-auth' with the project ID, client email and private key from auth's settings.",
      "It passes that app's Auth to verifierFrom.",
    ],
    why: "Google sign-in needs the project's own Firebase service account. A test builds one with a throwaway key for a made-up project and checks that a malformed token gets a 401 from the real SDK, which rejects it without using the network. No app calls it yet.",
    returns: 'The verifier from verifierFrom.',
    tests: [AUTH_FIREBASE_TEST],
  },
  {
    symbol: 'backend/services/auth/src/firebase.ts#googleSignInNotSetUp',
    status: 'not-wired',
    summary: 'The token check to use when the Firebase settings are not set.',
    why: "Outside production the Firebase settings are optional. Google sign-in then answers 503 service_unavailable, while dev sign-in still works. Because it is a 5xx, the client sees only 'Service unavailable'; the message 'Google sign-in is not set up on this server' is in auth's error log. No app uses it yet.",
    returns: 'A function that always rejects with that 503 error.',
    tests: [AUTH_FIREBASE_TEST],
  },
  {
    symbol: 'backend/services/auth/src/me-routes.ts#currentUser',
    status: 'not-wired',
    summary: 'Loads the user the internal token names.',
    why: "A session can outlive its user, for example after the account was deleted. Then the user is gone, and that is a 401, 'This account no longer exists', so the browser treats it as signed out.",
    returns: 'A promise of the user document.',
    tests: [AUTH_ME_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/auth/src/me-routes.ts#meRouter',
    status: 'not-wired',
    summary: "The signed-in user's own profile, and the user lookup for other services.",
    how: [
      'GET /me returns { user } with toProfile for the user in the internal token.',
      'PATCH /me takes { themePreference } (system, light or dark) and saves it. The body schema is strict, so any other field is a 400 instead of being ignored.',
      "GET /internal/users/:id returns the user only when :id is the token's own user. Another user's ID gets the same 404 as an unknown one, so the route can't reveal which accounts exist. A malformed ID is a 400.",
      'Every route needs a user in the internal token (requireUser), so a request with no session is a 401.',
    ],
    why: 'A user only ever sees and changes their own account. The internal route is how other services will look up the user a request is for. createApp does not add the router yet, so no running app serves it.',
    returns: 'An Express Router.',
    sideEffects: ['PATCH /me updates the user in MongoDB.'],
    tests: [AUTH_ME_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/auth/src/session-routes.ts#COOKIE_MAX_AGE_MS',
    status: 'not-wired',
    summary: 'How long the browser keeps the session cookie: 30 days.',
    why: 'Redis ends a session after 7 days without use (SESSION_TTL_SECONDS, renewed on every lookup), so an idle user is signed out after a week. The cookie limit caps even an active session at 30 days, after which the user signs in again.',
    returns: '2,592,000,000 milliseconds.',
    tests: [AUTH_SESSION_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter',
    status: 'not-wired',
    summary: 'The sign-in and logout routes: auth creates sessions, sets the cookie and ends them.',
    how: [
      'POST /sessions takes { idToken }, checks it with verifyIdToken, finds or makes the user with upsertGoogleUser and starts a session.',
      'POST /sessions/dev takes { email, name? } and does the same with findOrCreateDevUser. It is added only when devLogin is on, so without it the path is a 404.',
      "Starting a session creates it in Redis, sets the gilder_sid cookie (HttpOnly, SameSite=Lax, Path=/, Max-Age 30 days, plus Secure when secureCookie is on), records the user in the request context, logs 'signed in' with the method and whether the user is new, and answers { user } with toProfile.",
      'DELETE /sessions/current needs a user in the internal token (requireUser). It deletes the session the cookie names, clears the cookie and answers 204. Calling it twice, or without a cookie, still gives 204.',
      'Request bodies are checked with validate, so a missing token or a bad email is a 400.',
    ],
    why: 'One service owns sessions end to end, so the cookie settings live in one place. The gateway will map the public routes onto these paths. createApp does not add the router yet, so no running app serves them.',
    returns: 'An Express Router.',
    sideEffects: [
      'Writes and deletes session keys in Redis.',
      'Creates and updates users in MongoDB.',
      'Sets and clears the session cookie.',
    ],
    tests: [AUTH_SESSION_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#upsertGoogleUser',
    status: 'not-wired',
    summary: 'Finds the user for a Google sign-in, or makes one.',
    how: [
      'By Firebase ID first: the same ID is the same user, and its email, name and avatar are refreshed (a name or avatar the sign-in leaves out is kept).',
      'Then by email: a verified email already on file under another ID belongs to the same person, for example after the Firebase account was recreated or a local dev sign-in used it, so that user gets the new Firebase ID.',
      'Otherwise it creates the user. If a second sign-in creates the same user at the same moment, the unique index makes one fail, and that one finds the user the other made.',
    ],
    why: 'Sign-in must never create two accounts for one person. `created` tells the caller about a first sign-in, which the credits grant will need. Only the sign-in route calls it, and no running app serves that route yet.',
    returns: 'A promise of { user, created }.',
    sideEffects: ['Creates or updates a user in MongoDB.'],
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#findOrCreateDevUser',
    status: 'not-wired',
    summary: 'Finds the user with an email for dev sign-in, or makes one.',
    how: [
      'The email is trimmed and lowercased.',
      "A new user gets the Firebase ID 'dev:' plus the email. Real Firebase IDs never contain ':', so they can't collide.",
      'A parallel sign-in that creates the same user first is handled like in upsertGoogleUser.',
    ],
    why: 'Local development and tests need sessions without a Google account. A later Google sign-in with the same email takes over the account (see upsertGoogleUser). Only the dev sign-in route calls it.',
    returns: 'A promise of { user, created }.',
    sideEffects: ['May create a user in MongoDB.'],
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#THEME_PREFERENCES',
    status: 'not-wired',
    summary: "The themes a user can pick: 'system', 'light' or 'dark'.",
    why: "'system' follows the device's light or dark setting and is the default. The list types ThemePreference and limits the users model's themePreference field. No route reads or changes it yet.",
    returns: "A read-only array: 'system', 'light', 'dark'.",
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#userSchema',
    status: 'not-wired',
    summary: 'The shape and rules of a document in the users collection.',
    how: [
      'firebaseUid is required and unique: one user per Google account.',
      'email is required, unique, trimmed and stored in lowercase, so the same address in a different case is the same user. It is at most 254 characters.',
      'name (at most 100 characters) and avatarUrl (at most 2048) are optional and trimmed.',
      "themePreference is one of THEME_PREFERENCES and defaults to 'system'.",
      'timestamps adds createdAt and updatedAt.',
    ],
    why: 'The unique indexes make duplicate accounts impossible in the database itself, even if two sign-ins race. Mongoose works out the field types from it, so themePreference is typed as the three themes, not any string.',
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#UserModel',
    status: 'not-wired',
    summary: 'The Mongoose model for the users collection in the auth database (gilder_auth).',
    why: 'Only auth reads or writes users; other services will ask auth over HTTP. It is built from the `mongoose` that @gilder/shared re-exports, so it uses the connection connectMongo opens. Mongoose creates the unique indexes when the model first connects. No route uses it yet.',
    returns: 'A Mongoose model of User documents.',
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#toProfile',
    status: 'not-wired',
    summary: 'Turns a user document into what the API shows of a user.',
    how: [
      'It returns id, email, name, avatarUrl and themePreference.',
      'A name or avatar that is not set becomes null, so the shape is always the same.',
      'The Firebase ID is left out: it stays inside auth.',
    ],
    why: 'One function decides what leaves the service, so a new field in the model is never sent by accident. No route uses it yet.',
    returns: '{ id, email, name, avatarUrl, themePreference }',
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/chat/src/app.ts#createApp',
    status: 'verified',
    summary: "Builds the chat service's Express app.",
    how: [
      "It calls createService with the name 'chat' and the given logger and readiness checks.",
      'It adds no routes of its own yet; its comment says createService already serves /healthz and /readyz.',
      'At startup, index.ts passes one readiness check: mongo.',
    ],
    why: 'Building the app apart from starting it lets tests get the app without startService, a fixed port or real databases; supertest serves it on a temporary port. The logger and checks are passed in, so tests can use a silent logger and fake checks.',
    returns: 'An Express app with /healthz, /readyz and the shared 404 and error handling.',
    tests: [CHAT_TEST],
  },
  {
    symbol: 'backend/services/chat/src/env.ts#env',
    status: 'verified',
    summary: "The chat service's environment variables, checked at startup.",
    how: [
      'It extends baseEnvSchema with PORT (default 8002) and MONGODB_URI (required, not empty).',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The service refuses to start if MONGODB_URI is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB URL and the port.',
    returns: 'An object with NODE_ENV, LOG_LEVEL, PORT (a number) and MONGODB_URI.',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/services/agent/src/app.ts#createApp',
    status: 'verified',
    summary: "Builds the agent service's Express app.",
    how: [
      "It calls createService with the name 'agent' and the given logger and readiness checks.",
      'It adds no routes of its own yet; its comment says createService already serves /healthz and /readyz.',
      'At startup, index.ts passes two readiness checks: mongo and redis.',
    ],
    why: 'Building the app apart from starting it lets tests get the app without startService, a fixed port or real databases; supertest serves it on a temporary port. The logger and checks are passed in, so tests can use a silent logger and fake checks.',
    returns: 'An Express app with /healthz, /readyz and the shared 404 and error handling.',
    tests: [AGENT_TEST],
  },
  {
    symbol: 'backend/services/agent/src/env.ts#env',
    status: 'verified',
    summary: "The agent service's environment variables, checked at startup.",
    how: [
      'It extends baseEnvSchema with PORT (default 8003), MONGODB_URI and REDIS_URL (both required, not empty).',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The service refuses to start if MONGODB_URI or REDIS_URL is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB and Redis URLs and the port.',
    returns: 'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI and REDIS_URL.',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/services/billing/src/app.ts#createApp',
    status: 'verified',
    summary: "Builds the billing service's Express app.",
    how: [
      "It calls createService with the name 'billing' and the given logger and readiness checks.",
      'It adds no routes of its own yet; its comment says createService already serves /healthz and /readyz.',
      'At startup, index.ts passes one readiness check: mongo.',
    ],
    why: 'Building the app apart from starting it lets tests get the app without startService, a fixed port or real databases; supertest serves it on a temporary port. The logger and checks are passed in, so tests can use a silent logger and fake checks.',
    returns: 'An Express app with /healthz, /readyz and the shared 404 and error handling.',
    tests: [BILLING_TEST],
  },
  {
    symbol: 'backend/services/billing/src/env.ts#env',
    status: 'verified',
    summary: "The billing service's environment variables, checked at startup.",
    how: [
      'It extends baseEnvSchema with PORT (default 8004) and MONGODB_URI (required, not empty).',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The service refuses to start if MONGODB_URI is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB URL and the port.',
    returns: 'An object with NODE_ENV, LOG_LEVEL, PORT (a number) and MONGODB_URI.',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },

  // -------------------------------------------------------------------------------------------
  // frontend/src/app: the create-next-app starter

  {
    symbol: 'frontend/src/app/layout.tsx#RootLayout',
    status: 'verified',
    summary: 'The root layout of the Next.js app: the <html> and <body> around every page.',
    how: [
      'Next.js uses it because of its file name, src/app/layout.tsx; no project code calls it.',
      'It sets lang="en" and puts the Geist Sans and Geist Mono font variables on <html> as classes.',
      'It renders the current page inside <body>.',
      'The same file imports globals.css and exports metadata, still titled "Create Next App".',
    ],
    why: "Next.js's App Router needs a root layout that renders <html> and <body>. This one is the unchanged Next.js starter, to be replaced by the real app shell (planned: Sign-in page and app shell).",
    returns: 'The <html> element that wraps every page.',
  },
  {
    symbol: 'frontend/src/app/page.tsx#Home',
    status: 'verified',
    summary: 'The page at /, still the create-next-app starter page.',
    how: [
      'Next.js serves it at / because of its file name, src/app/page.tsx; no project code calls it.',
      'It shows the Next.js logo, a "To get started, edit the page.tsx file." heading, and links to Vercel templates, the Next.js learning center, Vercel deploys and the Next.js docs.',
      'Its images use next/image.',
    ],
    why: 'It is placeholder content: the unchanged Next.js starter, to be replaced by the real app shell (planned: Sign-in page and app shell).',
    returns: 'The starter page as JSX.',
  },
];

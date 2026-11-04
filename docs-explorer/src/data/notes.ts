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
const SERVICE_TEST = 'backend/shared/src/service.test.ts';

const GATEWAY_TEST = 'backend/gateway/src/app.test.ts';
const AUTH_TEST = 'backend/services/auth/src/app.test.ts';
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
    why: 'Every app needs these two, so they are defined once. Each app extends this schema with its own variables in its src/env.ts.',
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
    why: 'Clients can check a stable code (like not_found) instead of parsing messages. AppError and toProblem look up the status and title here, so each is set in one place. Today the running apps only raise not_found, bad_request, payload_too_large and internal_error; no app raises the others yet.',
    returns: 'An object of 11 codes, from bad_request (400) to service_unavailable (503).',
    tests: [SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/errors.ts#AppError',
    status: 'verified',
    summary: 'An error that is safe to describe to the client, with an error code and HTTP status.',
    why: 'Code can throw an AppError anywhere and the error handler turns it into the right response. Any error that is not an AppError becomes a generic 500, so internal details never reach the client by accident.',
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST],
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
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST],
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
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST, ...APP_TESTS],
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
    tests: [SERVICE_TEST, INTERNAL_TOKEN_TEST, ...APP_TESTS],
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
      'Anything else becomes internal_error (500), with the original kept as `cause`.',
    ],
    why: 'The error handler can then treat every error the same way. Unknown errors become a 500, whose message is never shown to the client.',
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
    why: 'Services only need the public key: it can check a token but cannot make one. It always imports the key for EdDSA. No app imports a key yet.',
    returns: 'A promise of the key object (InternalKey).',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#generateInternalKeyPair',
    status: 'not-wired',
    summary: 'Creates a new EdDSA key pair and returns both keys as PEM text.',
    how: [
      'It generates the pair with jose, marked extractable so it can be exported.',
      'It exports the private key as PKCS8 PEM and the public key as SPKI PEM.',
    ],
    why: 'Its comment says it is for .env files and tests. The private key signs tokens and the public key checks them. Only the tests call it today.',
    returns: 'A promise of { privateKey, publicKey }, both PEM strings.',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#signInternalToken',
    status: 'not-wired',
    summary: 'Signs a short-lived token that says which user a forwarded request is for.',
    how: [
      'The subject (`sub`) is the user ID.',
      'The request ID, when given, goes in a `rid` claim.',
      'The issuer is gilder-gateway and the audience is the service the token is for.',
      'It expires after `ttlSeconds` (60 by default) and is signed with EdDSA.',
    ],
    why: 'Services never trust a plain user-ID header, because anything that can reach a service could claim to be any user. So services accept only a signed token addressed to them. The audience stops a token for one service being used against another, and the short life limits the harm if one leaks. No app signs tokens yet.',
    returns: 'A promise of the signed token, a JWT string.',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#verifyInternalToken',
    status: 'not-wired',
    summary: 'Checks an internal token and reads the user (and request ID) from it.',
    how: [
      'jose checks the signature, the issuer, the audience and the expiry, and accepts only EdDSA.',
      '`currentDate` lets tests pretend time has passed.',
      'It throws if the token has no subject.',
      'It returns the user ID, plus the request ID when the `rid` claim is a string.',
    ],
    why: 'A service must reject a token that is missing, forged, expired or addressed to another service. Only requireInternalToken calls it, and no app uses that yet.',
    returns: 'A promise of { userId, requestId? }. It rejects when any check fails.',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#requireInternalToken',
    status: 'not-wired',
    summary: 'Middleware for services: lets a request through only with a valid internal token.',
    how: [
      'It reads the x-internal-token header.',
      "A missing header throws AppError('unauthorized').",
      "A token that fails verifyInternalToken throws AppError('unauthorized'), keeping the original error as `cause`.",
      'On success it stores the user ID in `res.locals.userId` and in the request context, then calls next().',
      'Express 5 passes errors thrown in async middleware to the error handler, which answers 401.',
    ],
    why: 'It is how a service will know which user a request is for, and that it really came through the gateway. A direct call without a valid token gets 401. No app adds it to a route yet.',
    returns: 'An async Express middleware function.',
    sideEffects: [
      'Sets res.locals.userId.',
      'Adds the user ID to the request context, so later log lines carry it.',
    ],
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
  // backend/shared/src/redis.ts

  {
    symbol: 'backend/shared/src/redis.ts#createRedis',
    status: 'verified',
    summary: "Creates a Redis client whose connection errors go to the app's logger.",
    how: [
      'It creates an ioredis client for the URL, which starts connecting straight away.',
      'It sets maxRetriesPerRequest to 2 (the ioredis default is 20). In ioredis this counter belongs to the client, not to each command.',
      'While Redis is down, commands wait in the offline queue. ioredis fails the whole queue with MaxRetriesPerRequestError only on every 3rd failed connection attempt (retryAttempts % (maxRetriesPerRequest + 1) === 0).',
      'Reconnect delays grow to at most 5 seconds, so a queued command can wait about 15 seconds before it fails.',
      'It listens for `error` events and logs them.',
    ],
    why: 'Without a listener, ioredis would only print "[ioredis] Unhandled error event" to stderr with console.error; it does not throw. The listener sends these errors to the structured pino logger at level error instead, like every other log line. The client keeps reconnecting meanwhile, and /readyz reports Redis as failed. The gateway, auth and agent use it.',
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
    why: 'Request IDs go into every log line and back into the response header. The pattern limits how long an incoming ID can be and which characters it may contain; any other value is replaced with a new random UUID.',
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
      'It runs the rest of the request inside runWithContext, so every log line carries the ID.',
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
      'pino-http logs each request with that ID, except /healthz and /readyz.',
      'The log level follows the result: error for failures and 5xx, warn for 4xx, info otherwise.',
      'helmet() sets security headers.',
      'express.json() parses JSON bodies up to `bodyLimit` (64kb by default).',
      'healthRouter() adds /healthz and /readyz.',
      "The app's own `routes` come next.",
      'notFoundHandler() and errorHandler() come last, to catch whatever is left.',
    ],
    why: 'Middleware order matters: the request ID must exist before anything logs, and the error handler must come last. Writing the order once means all five apps get it right.',
    returns: 'The Express app, not listening yet.',
    sideEffects: [
      'For each request once the app listens: sets security headers and X-Request-Id, and writes a request log line (not for health checks).',
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
      'After `shutdownTimeoutMs` (10 seconds by default) it force-closes any connection still open.',
      'Then it runs `onShutdown` (where apps close their databases) and logs "shut down cleanly".',
      'Calling close() again returns the same promise.',
      'Unless `handleSignals` is false, SIGTERM or SIGINT runs close(), then exits with code 0, or logs "shutdown failed" and exits with code 1.',
    ],
    why: 'Stopping abruptly would cut requests off halfway. This lets running requests finish, with a time limit so one stuck connection cannot block shutdown forever. Tests turn signals off and call close() themselves.',
    returns:
      'A promise of { port, close }. `port` is the real port, which matters when port 0 asks the system for a free one.',
    sideEffects: [
      'Opens a listening port.',
      'Logs "listening" once open, "shutting down" when a signal arrives and "shut down cleanly" after close() finishes.',
      'Adds one-time SIGTERM and SIGINT listeners to the process.',
      'Exits the process after a shutdown started by a signal.',
    ],
    tests: [SERVICE_TEST],
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
      'It extends baseEnvSchema with PORT (default 8001), MONGODB_URI and REDIS_URL (both required, not empty).',
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

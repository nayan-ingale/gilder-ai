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
const GATEWAY_ENV_SCHEMA_TEST = 'backend/gateway/src/env-schema.test.ts';
const GATEWAY_ROUTE_TABLE_TEST = 'backend/gateway/src/route-table.test.ts';
const GATEWAY_GUARDS_TEST = 'backend/gateway/src/guards.test.ts';
const GATEWAY_PROXY_TEST = 'backend/gateway/src/proxy.test.ts';
/**
 * The real auth and chat apps on their own ports behind the real gateway: sign-in, profile,
 * logout, chats, SEC-01/02/04/06.
 */
const JOURNEY_TEST = 'backend/gateway/src/journey.test.ts';
const AUTH_TEST = 'backend/services/auth/src/app.test.ts';
const AUTH_ENV_SCHEMA_TEST = 'backend/services/auth/src/env-schema.test.ts';
const AUTH_USERS_TEST = 'backend/services/auth/src/users.test.ts';
const AUTH_FIREBASE_TEST = 'backend/services/auth/src/firebase.test.ts';
const AUTH_SESSION_ROUTES_TEST = 'backend/services/auth/src/session-routes.test.ts';
const AUTH_ME_ROUTES_TEST = 'backend/services/auth/src/me-routes.test.ts';
const CHAT_TEST = 'backend/services/chat/src/app.test.ts';
const CHAT_MODELS_TEST = 'backend/services/chat/src/models.test.ts';
const CHAT_ROUTES_TEST = 'backend/services/chat/src/chat-routes.test.ts';
const CHAT_INTERNAL_ROUTES_TEST = 'backend/services/chat/src/internal-routes.test.ts';
const AGENT_TEST = 'backend/services/agent/src/app.test.ts';
const BILLING_TEST = 'backend/services/billing/src/app.test.ts';

/** Each app's test sends /healthz, /readyz and an unknown route through the shared middleware. */
const APP_TESTS = [GATEWAY_TEST, AUTH_TEST, CHAT_TEST, AGENT_TEST, BILLING_TEST];

const FRONTEND_CHATS_TEST = 'frontend/src/components/chats/chats.test.tsx';
const FRONTEND_CHATS_LIB_TEST = 'frontend/src/lib/chats.test.ts';
const FRONTEND_SERVER_CHATS_TEST = 'frontend/src/server/chats.test.ts';
const FRONTEND_SESSION_TEST = 'frontend/src/server/session.test.ts';

export const notes: SymbolNote[] = [
  // -------------------------------------------------------------------------------------------
  // backend/shared/src/constants.ts

  {
    symbol: 'backend/shared/src/constants.ts#AGENTS',
    status: 'verified',
    summary: 'The list of every agent a chat turn can run.',
    why: "One list that the rest of the code shares, so agent names are spelled the same everywhere. The `Agent` type is built from it, so code typed with Agent cannot use a misspelled name. Chat reads it: a message's agent field accepts only these names, both in the messages model and in POST /internal/messages.",
    returns:
      'A read-only array of eight names: chat, search, code, pdf, slides, image, pdf_qa and image_qa.',
    tests: [CONSTANTS_TEST, CHAT_MODELS_TEST],
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
    symbol: 'backend/shared/src/constants.ts#GATEWAY_RATE_LIMITS',
    status: 'verified',
    summary: 'How many requests a minute the gateway lets through: per IP address and per user.',
    why: "The gateway's ipRateLimit reads `perIp` and its userRateLimit reads `perUser`. The per-IP limit covers every request, signed in or not; the per-user one counts a signed-in user across all their devices. `as const` keeps the exact numbers.",
    returns: '{ perIp: 120, perUser: 60 }',
    tests: [GATEWAY_GUARDS_TEST],
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
    status: 'verified',
    summary: 'Adds the user ID to the current request context once the caller is known.',
    how: [
      'It reads the current context.',
      'If there is one, it sets `userId` on that same object.',
      'Outside a request it does nothing.',
    ],
    why: "The user is only known after authentication, which runs after the request ID is set. Changing the existing object means every later log line in the request carries the user too. Three places call it: the gateway's sessionLookup once a session cookie names a user, requireInternalToken in a service when the token names a user, and auth's sign-in once it knows who signed in.",
    sideEffects: ['Changes the current request context object.'],
    tests: [LOGGER_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/env.ts

  {
    symbol: 'backend/shared/src/env.ts#baseEnvSchema',
    status: 'verified',
    summary: 'The Zod schema for the variables every app reads: NODE_ENV and LOG_LEVEL.',
    why: 'Every app needs these two, so they are defined once. Each app extends this schema with its own variables: in its src/env.ts, or for the gateway and auth in src/env-schema.ts.',
    returns:
      'A Zod object schema. NODE_ENV is development, test or production (default development). LOG_LEVEL is a pino level from fatal to trace, or silent (default info).',
    tests: [ENV_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#internalPublicKeySchema',
    status: 'verified',
    summary:
      "The Zod schema for INTERNAL_PUBLIC_KEY, the gateway's public key every service needs.",
    how: [
      "A missing value fails with 'is missing: run pnpm setup:keys'.",
      'Escaped `\\n` line breaks are turned back into real ones, so the key works with or without double quotes in .env.',
      "The result must start with -----BEGIN PUBLIC KEY-----, or it fails with 'is not a PEM public key: run pnpm setup:keys'.",
    ],
    why: 'Auth, chat, agent and billing all check internal tokens, so they share one rule for the key that checks them. Neither message repeats the value. It looks only at the PEM header: whether the rest is a usable key shows when index.ts imports it with importInternalPublicKey.',
    returns: 'A Zod schema whose parsed value is the PEM text, with real line breaks.',
    tests: [AUTH_ENV_SCHEMA_TEST],
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
    why: 'Clients can check a stable code (like not_found) instead of parsing messages. AppError and toProblem look up the status and title here, so each is set in one place. Every app can raise not_found and internal_error, and its body parser payload_too_large and unsupported_media_type; bad_request comes from the JSON parser, which the gateway does not use. The services raise unauthorized from their internal-token check. Auth also raises validation_failed (from validate), unauthorized (from requireUser and its own sign-in and /me checks) and service_unavailable (Google sign-in without the Firebase settings). The gateway raises rate_limited (its rate limits), forbidden (originCheck), unauthorized (requireSession) and service_unavailable (a service that is down or slow). No code raises insufficient_credits or conflict yet.',
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
      "If a response has already started (for example a stream), it calls next(err). Express's final handler then destroys the socket and, unless Express's env setting (from NODE_ENV) is test, prints the error to stderr with console.error, bypassing pino and its redaction. The gateway's proxy streams answers, but it throws nothing once it has started writing (a failed stream destroys the response instead), so no code is known to reach this path.",
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
    status: 'verified',
    summary: 'The name of the header that carries the internal token.',
    why: "The gateway and the services must agree on the header name, so it is defined once. The logger separately redacts this header, so tokens never reach the logs. The gateway's proxyToService sets it on every request it forwards, and requireInternalToken reads it in auth, chat, agent and billing.",
    returns: "The string 'x-internal-token'.",
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#ISSUER',
    status: 'verified',
    summary: 'The issuer written into, and required on, every internal token.',
    why: 'signInternalToken writes it into every token and verifyInternalToken rejects a token with any other issuer. The name says the gateway is the one that signs them.',
    returns: "The string 'gilder-gateway'.",
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#ALGORITHM',
    status: 'verified',
    summary: 'The one signing algorithm internal tokens use.',
    why: 'Keys are imported for it, tokens are signed with it, and verification accepts only it. Fixing one algorithm means a token cannot choose a different one.',
    returns: "The string 'EdDSA'.",
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#importInternalPrivateKey',
    status: 'verified',
    summary: 'Turns a private key in PEM text into a key object that can sign internal tokens.',
    why: "Keys are kept as PEM text, for example in .env files, but jose signs with a key object. It always imports the key for EdDSA. The gateway's index.ts imports INTERNAL_PRIVATE_KEY with it at startup and passes the key to createApp, which signs every forwarded request with it. The gateway's settings check has already made sure the text parses as an Ed25519 private key.",
    returns: 'A promise of the key object (InternalKey).',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#importInternalPublicKey',
    status: 'verified',
    summary: 'Turns a public key in PEM text into a key object that can verify internal tokens.',
    why: 'Services only need the public key: it can check a token but cannot make one. It always imports the key for EdDSA. Auth, chat, agent and billing each import INTERNAL_PUBLIC_KEY with it in index.ts at startup and pass the key to createApp for the internal-token check. Their settings check only looks at the PEM header, so a key that has the header but cannot be read makes it reject; nothing catches that, so the service exits with code 1 before it listens.',
    returns: 'A promise of the key object (InternalKey).',
    tests: [INTERNAL_TOKEN_TEST, AUTH_TEST, CHAT_TEST, AGENT_TEST, BILLING_TEST],
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
    status: 'verified',
    summary:
      'Signs a short-lived token that proves a forwarded request came through the gateway, and names its user when there is one.',
    how: [
      'The subject (`sub`) is the user ID, set only when a user ID is given. A token for a request with no session, such as a sign-in, has no `sub`.',
      'The request ID, when given, goes in a `rid` claim.',
      'The issuer is gilder-gateway and the audience is the service the token is for.',
      'It expires after `ttlSeconds` (60 by default) and is signed with EdDSA.',
    ],
    why: "Services never trust a plain user-ID header, because anything that can reach a service could claim to be any user. So services accept only a signed token addressed to them. A token without a user still proves the request came through the gateway, so no service route has to be open to direct calls. The audience stops a token for one service being used against another, and the short life limits the harm if one leaks. The gateway's proxyToService signs a fresh one for every request it forwards, with the default 60 seconds.",
    returns: 'A promise of the signed token, a JWT string.',
    tests: [INTERNAL_TOKEN_TEST, GATEWAY_PROXY_TEST, GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#verifyInternalToken',
    status: 'verified',
    summary: 'Checks an internal token and reads the user and request ID from it, when present.',
    how: [
      'jose checks the signature, the issuer, the audience and the expiry, and accepts only EdDSA.',
      '`currentDate` lets tests pretend time has passed.',
      'It returns `userId` only when `sub` is a non-empty string, and `requestId` only when the `rid` claim is a string.',
      'A valid token with no subject is accepted; the result just has no `userId`.',
    ],
    why: 'A service must reject a token that is missing, forged, expired or addressed to another service. Whether a route needs a user is a separate check, requireUser. Only requireInternalToken calls it, which auth, chat, agent and billing put in front of their routes.',
    returns:
      'A promise of { userId?, requestId? }, an empty object for a valid token with neither. It rejects when any check fails.',
    tests: [INTERNAL_TOKEN_TEST, SERVICE_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#requireInternalToken',
    status: 'verified',
    summary: 'Middleware for services: lets a request through only with a valid internal token.',
    how: [
      'It reads the x-internal-token header.',
      "A missing header throws AppError('unauthorized', 'Missing internal token').",
      "A token that fails verifyInternalToken throws AppError('unauthorized', 'Invalid internal token'), keeping the original error as `cause`.",
      'When the token names a user, it stores the user ID in `res.locals.userId` and in the request context.',
      'A valid token with no user passes too, with no user set. It does not require one: routes that act for a user add requireUser() after it.',
      'Express 5 passes errors thrown in async middleware to the error handler, which answers 401.',
    ],
    why: 'It is how a service knows that a request really came through the gateway, and which user it is for. A direct call without a valid token gets 401. With the `internalAuth` option, createService puts it in front of every route except /healthz and /readyz. Auth, chat, agent and billing pass that option, each with its own name as the audience. The gateway signs the tokens it checks.',
    returns: 'An async Express middleware function.',
    sideEffects: [
      'Sets res.locals.userId when the token names a user.',
      'Adds that user ID to the request context, so later log lines carry it.',
    ],
    tests: [
      INTERNAL_TOKEN_TEST,
      SERVICE_TEST,
      AUTH_TEST,
      CHAT_TEST,
      AGENT_TEST,
      BILLING_TEST,
      JOURNEY_TEST,
    ],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#requireUser',
    status: 'verified',
    summary:
      'Middleware for routes that act for a user: answers 401 unless the internal token named one.',
    how: [
      'It runs after requireInternalToken, which sets `res.locals.userId` only when the token has a user.',
      "Without `res.locals.userId`, it passes AppError('unauthorized', 'This route needs a signed-in user') to the error handler, which answers 401.",
      'Otherwise it calls next().',
    ],
    why: 'A valid internal token only proves that a request came through the gateway; requests with no session, such as a sign-in, carry one too. Routes that must know the user add this check on top: in auth, DELETE /sessions/current, GET and PATCH /me and GET /internal/users/:id; in chat, every /chats and /internal route.',
    returns: 'An Express middleware function.',
    tests: [INTERNAL_TOKEN_TEST, CHAT_ROUTES_TEST, CHAT_INTERNAL_ROUTES_TEST],
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
    status: 'verified',
    summary: 'Counts one request for a caller in Redis and says whether it is within the limit.',
    how: [
      'The Redis key is rl:<scope>:<id>, so each scope and each caller has its own count.',
      'One MULTI transaction increments the count, starts the expiry with EXPIRE ... NX (only if none is running) and reads the time left with TTL.',
      'It throws if the transaction is aborted or any of its three commands fails.',
      'The request is allowed while the count is at most `limit`.',
      'The window lasts `windowSeconds` (60 by default) from the first request. Later requests do not extend it, and the count starts over when the key expires.',
    ],
    why: 'Counting in Redis means every copy of an app shares the same counts. The count and its expiry are set in one transaction, so a counter is never left behind without an expiry. EXPIRE with NX needs Redis 7 or later; backend/docker-compose.yml and CI run redis:7-alpine. Only rateLimit calls it, which the gateway uses for its per-IP and per-user limits (keys rl:ip:<address> and rl:user:<user ID>).',
    returns:
      'A promise of { allowed, remaining, retryAfterSeconds }. `remaining` never goes below 0. `retryAfterSeconds` is the time left in the window, or `windowSeconds` when TTL gives no positive value.',
    sideEffects: ['Increments a counter in Redis, and sets its expiry when the window starts.'],
    tests: [RATE_LIMIT_TEST, GATEWAY_GUARDS_TEST],
  },
  {
    symbol: 'backend/shared/src/rateLimit.ts#rateLimit',
    status: 'verified',
    summary: 'Middleware that answers 429 once a caller has used up its limit.',
    how: [
      '`keyOf` picks what is counted, such as the IP address or the signed-in user.',
      'When `keyOf` returns undefined, the request is not counted and goes on.',
      'Otherwise it counts the request with hitRateLimit.',
      "Over the limit, it sets the Retry-After header to the seconds left in the window and throws AppError('rate_limited'), whose message says when to try again.",
      'Express 5 passes errors thrown in async middleware to the error handler, which answers 429.',
      'If the Redis call fails, that error reaches the error handler too, which answers 500: the request is refused, not let through.',
    ],
    why: 'It puts a limit in front of routes in one line, with the counts shared through Redis. Retry-After tells a well-behaved client how long to wait. The gateway builds two from it (ipRateLimit and userRateLimit) and runs them on every request that reaches its /api router.',
    returns: 'An async Express middleware function.',
    sideEffects: ['Counts the request in Redis.', 'Sets the Retry-After header on a 429.'],
    tests: [RATE_LIMIT_TEST, GATEWAY_GUARDS_TEST],
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
    why: "Reusing the caller's ID lets one ID follow a request through the frontend, the gateway and every service: the gateway's proxyToService sends its own request ID on in this header, so the service it calls logs the same ID. Error responses include it too. createService installs it first in every app.",
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
    why: 'Middleware order matters: the request ID must exist before anything logs, health probes must not need a token, and the error handler must come last. The token check runs before the routes, so a call without a token cannot learn from a 404 which paths exist. Writing the order once means all five apps get it right. The gateway turns `parseJson` off, so it forwards bodies to the services untouched, and passes its /api router as its routes. Auth, chat, agent and billing pass `internalAuth`, and auth and chat also their own routes.',
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
    status: 'verified',
    summary: 'The name of the cookie that carries the session ID.',
    why: "The app that sets the cookie and the app that reads it must agree on the name, so it is defined once. The logger redacts the Cookie and Set-Cookie headers, so the session ID never reaches the logs. sessionIdFromCookies and auth's sign-in routes use it.",
    returns: "The string 'gilder_sid'.",
  },
  {
    symbol: 'backend/shared/src/sessions.ts#SESSION_TTL_SECONDS',
    status: 'verified',
    summary: 'How long a session lasts after it was last used.',
    why: "createSession sets this expiry and resolveSession restarts it on every lookup, so a session in use stays alive and an unused one ends by itself. backend/docker-compose.yml runs Redis with noeviction, so Redis never drops a session to free memory; its comment says every key has an expiry instead. Auth's sign-in creates sessions with it, and the gateway's sessionLookup renews it on every request that carries a valid session cookie.",
    returns: '604,800 seconds (7 days).',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#SESSION_ID_BYTES',
    status: 'verified',
    summary: 'How many random bytes make up a session ID.',
    why: 'Per its comment, 32 random bytes give too many possibilities to guess. As base64url they make a 43-character ID of letters, digits, hyphens and underscores. Only createSession reads it.',
    returns: 'The number 32.',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#SESSION_ID_FORMAT',
    status: 'verified',
    summary: 'The shape every real session ID has: 43 base64url characters.',
    why: 'The session ID comes from a cookie, which the caller controls. resolveSession and deleteSession check it against this pattern first and stop when it does not match, so a malformed value never reaches Redis.',
    returns: 'A regular expression for exactly 43 letters, digits, underscores or hyphens.',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#sessionKey',
    status: 'verified',
    summary:
      'The Redis key a session is stored under: sess: followed by the SHA-256 hash of its ID.',
    why: 'Redis never holds the session ID itself, so someone who reads a Redis dump sees no IDs they could put in a cookie. The same ID always gives the same key, so a lookup is a single read. createSession, resolveSession and deleteSession all use it.',
    returns: 'A string like sess:<64 hex characters>.',
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#createSession',
    status: 'verified',
    summary: 'Starts a session for a user and returns its ID, the value for the session cookie.',
    how: [
      'It makes a new ID from 32 random bytes, as base64url.',
      'It stores { userId } as JSON under sessionKey(ID), with SET ... EX so it expires after 7 days.',
      'It returns the ID; only its hash is in Redis.',
    ],
    why: "Sessions live in Redis, so any copy of any app can read them. Per the file comment, auth creates and deletes sessions and the gateway looks them up on every request. Auth's sign-in routes call it, and the gateway's sessionLookup reads the session back. Each call makes a new session, so one user can be signed in on several devices at once.",
    returns: 'A promise of the session ID, a 43-character string.',
    sideEffects: ['Writes one key to Redis, with a 7-day expiry.'],
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#resolveSession',
    status: 'verified',
    summary: 'Finds the session for an ID from a cookie and restarts its 7 days.',
    how: [
      'It returns undefined straight away when the ID does not match SESSION_ID_FORMAT.',
      'GETEX reads the session and sets its expiry back to 7 days in one round trip.',
      'A missing or expired key gives undefined.',
      'Otherwise parseSession checks the stored value.',
    ],
    why: "The cookie is input from the caller, so nothing about it is assumed: a malformed ID, an unknown or expired session and a damaged stored value all mean 'no session'. Restarting the expiry on each lookup means a session ends 7 days after it was last used, not 7 days after it was made. The gateway's sessionLookup calls it for every request that matches a route and carries a session cookie.",
    returns: 'A promise of { userId }, or undefined when there is no valid session.',
    sideEffects: ["Resets the session's expiry in Redis to 7 days."],
    tests: [SESSIONS_TEST, GATEWAY_GUARDS_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#deleteSession',
    status: 'verified',
    summary: 'Ends one session (logout).',
    how: [
      'An ID that does not match SESSION_ID_FORMAT is ignored.',
      'Otherwise it deletes the key from sessionKey(ID).',
      'An unknown or already deleted session is not an error: it resolves either way.',
    ],
    why: "Only that session ends, so the user stays signed in on their other devices. Logging out twice, or after the session expired, does no harm. Auth's logout route (DELETE /sessions/current) calls it.",
    returns: 'A promise that resolves once done.',
    sideEffects: ['Deletes the session key from Redis.'],
    tests: [SESSIONS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#sessionIdFromCookies',
    status: 'verified',
    summary: "Reads the session ID from a request's Cookie header.",
    how: [
      "The cookie package's parseCookie splits the header into name and value pairs.",
      'It returns the SESSION_COOKIE value, or undefined when there is no header, no session cookie or an empty one.',
    ],
    why: "Auth's logout route reads the session it must end this way, and the gateway's sessionLookup reads it the same way, so both parse the cookie identically. The value is still untrusted: resolveSession and deleteSession check its shape before using it.",
    returns: 'The session ID string, or undefined.',
    tests: [SESSIONS_TEST, GATEWAY_GUARDS_TEST],
  },
  {
    symbol: 'backend/shared/src/sessions.ts#parseSession',
    status: 'verified',
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
    why: "For tests only: the shared sessions.test.ts and rateLimit.test.ts, auth's app.test.ts and session-routes.test.ts, and the gateway's app.test.ts and guards.test.ts make one before each test and clean it up after; the gateway's journey.test.ts makes one for the whole file. Tests running at the same time, even in other packages, never see each other's keys, and cleanup deletes only this test's keys.",
    returns: 'A promise of { redis, keys, cleanup }.',
    sideEffects: ['Opens a connection to the test Redis.'],
    tests: [
      SESSIONS_TEST,
      RATE_LIMIT_TEST,
      AUTH_TEST,
      AUTH_SESSION_ROUTES_TEST,
      GATEWAY_TEST,
      GATEWAY_GUARDS_TEST,
      JOURNEY_TEST,
    ],
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
    why: "For tests only: an app's tests import it from `@gilder/shared/testing`, a separate entry that the running apps never load. Each call starts its own server, so test files running at the same time never share data. auth's users.test.ts, session-routes.test.ts and me-routes.test.ts, chat's models.test.ts, chat-routes.test.ts and internal-routes.test.ts, and the gateway's journey.test.ts use it.",
    returns: 'A promise of { stop }.',
    sideEffects: ['Starts a mongod process and connects Mongoose to it.'],
    tests: [
      AUTH_USERS_TEST,
      AUTH_SESSION_ROUTES_TEST,
      AUTH_ME_ROUTES_TEST,
      CHAT_MODELS_TEST,
      CHAT_ROUTES_TEST,
      CHAT_INTERNAL_ROUTES_TEST,
      JOURNEY_TEST,
    ],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/validate.ts

  {
    symbol: 'backend/shared/src/validate.ts#validate',
    status: 'verified',
    summary: "Middleware that checks a request's params, query and body with Zod schemas.",
    how: [
      'It parses each part that has a schema.',
      'It collects every problem, with paths like body.name.',
      "If there are any, it passes one AppError('validation_failed') holding all of them to the error handler, which answers 400.",
      'Otherwise it replaces each part with the parsed value, so handlers get typed, converted data (for example the number 5, not the text "5").',
      'It redefines req.query instead of assigning it, because Express 5 exposes req.query through a getter.',
    ],
    why: "Handlers can trust their input, and clients learn about every bad field in one response instead of one at a time. Auth's routes use it: POST /sessions, POST /sessions/dev and PATCH /me check their body, and GET /internal/users/:id its params. Every chat route uses it too, for the chat ID, the list's query, cursor and limit, and the bodies, which are strict, so an unknown field such as userId is a 400.",
    returns: 'An Express middleware function.',
    sideEffects: ['Replaces req.params, req.query and req.body with the parsed values.'],
    tests: [
      SERVICE_TEST,
      AUTH_SESSION_ROUTES_TEST,
      AUTH_ME_ROUTES_TEST,
      CHAT_ROUTES_TEST,
      CHAT_INTERNAL_ROUTES_TEST,
    ],
  },

  // -------------------------------------------------------------------------------------------
  // The five apps: createApp and env

  {
    symbol: 'backend/gateway/src/app.ts#createApp',
    status: 'verified',
    summary:
      'Builds the gateway: the one public entry to the backend, which checks each /api request and forwards it to its service.',
    how: [
      "It builds an /api router with, in this order: ipRateLimit; a matcher that looks the method and path up with matchRoute and stores the result in `res.locals.route`, or calls `next('router')` to leave the router when nothing matches; originCheck; sessionLookup; userRateLimit; requireSession, only when the matched route needs a session; express.raw, which reads any body as raw bytes up to 1 MB (MAX_BODY); and proxyToService.",
      "It calls createService with the name 'gateway', the logger, the readiness checks and `parseJson: false`, so no body is parsed as JSON. Its routes set Express's `trust proxy` to trustProxyHops, so `req.ip` is the client's address read from X-Forwarded-For across that many proxies, then mount the router.",
      'A request that leaves the router reaches the shared 404 handler and never reaches a service. /healthz and /readyz are answered before the router, so they are not rate-limited.',
      'At startup, index.ts passes one readiness check (redis), the Redis client, the imported INTERNAL_PRIVATE_KEY, the four service URLs, FRONTEND_ORIGIN as allowedOrigins and TRUST_PROXY_HOPS.',
    ],
    why: "Every check every request needs lives in one place, cheapest first, and the route table decides what may reach a service at all, so a service's internal routes cannot be called from outside. Building the app apart from starting it lets tests pass a test Redis, a key pair made for the test and a stand-in service, or the real auth and chat apps (journey.test.ts). The optional `headersTimeoutMs` can shorten the proxy's 10-second wait for a service; index.ts does not set it.",
    returns:
      'An Express app with /healthz and /readyz, the /api router in front of the services, and the shared 404 and error handling.',
    tests: [GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/gateway/src/app.ts#MAX_BODY',
    status: 'verified',
    summary: 'The largest request body the gateway reads and forwards: 1 MB.',
    why: 'Per its comment, bodies are passed on as raw bytes and never parsed in the gateway; each service parses JSON itself, up to its own 64kb limit, and files are meant to go straight to storage, not through the gateway. A bigger body gets 413 payload_too_large from express.raw before anything is forwarded.',
    returns: "The string '1mb'.",
  },
  {
    symbol: 'backend/gateway/src/env.ts#env',
    status: 'verified',
    summary: "The gateway's environment variables, checked at startup.",
    how: [
      'It is one line, `loadEnv(gatewayEnvSchema)`: the settings and their rules live in env-schema.ts.',
      'loadEnv checks process.env against that schema when the file is first imported.',
    ],
    why: 'The gateway refuses to start if a setting is missing or invalid, and lists every problem at once, before it connects to anything. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads all of it: the log level and NODE_ENV (pretty logs in development), the Redis URL, the private key, the four service URLs, the frontend origins, the proxy hops and the port.',
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), REDIS_URL, FRONTEND_ORIGIN (an array of origins), AUTH_SERVICE_URL, CHAT_SERVICE_URL, AGENT_SERVICE_URL, BILLING_SERVICE_URL, INTERNAL_PRIVATE_KEY and TRUST_PROXY_HOPS (a number).',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/gateway/src/env-schema.ts#gatewayEnvSchema',
    status: 'verified',
    summary: "The gateway's settings and their rules, as a Zod schema.",
    how: [
      'It extends baseEnvSchema with PORT (default 8000) and REDIS_URL (required, not empty).',
      'FRONTEND_ORIGIN is one origin or several separated by commas. Each part is trimmed, empty parts are dropped, and each must be an http(s) origin (toOrigin); at least one is needed. The parsed value is an array, with any trailing slash gone.',
      'AUTH_SERVICE_URL, CHAT_SERVICE_URL, AGENT_SERVICE_URL and BILLING_SERVICE_URL must be http(s) URLs (serviceUrl); trailing slashes are stripped.',
      'INTERNAL_PRIVATE_KEY, which signs the internal tokens, is required. Escaped `\\n` line breaks are turned back into real ones, and the result must parse as an Ed25519 private key (isEd25519PrivateKey). Its messages say to run `pnpm setup:keys` and never repeat the value.',
      "TRUST_PROXY_HOPS is a whole number from 0 to 5 (default 1): how many proxies in front of the gateway to trust for the client's IP address.",
    ],
    why: 'A wrong origin list, service URL or key would break every request, so the gateway refuses to start instead. The schema lives apart from env.ts, which loads it at startup, so tests can check the rules without a real environment.',
    returns: 'A Zod object schema.',
    tests: [GATEWAY_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/gateway/src/env-schema.ts#toOrigin',
    status: 'verified',
    summary: 'Checks that one FRONTEND_ORIGIN entry is just an origin, and returns it.',
    how: [
      'Text that is not a URL is an issue: \'"<value>" is not a URL\'.',
      'A URL that is not http or https, or that has a path, query or fragment (apart from one trailing slash), is an issue: \'"<value>" must be just an origin, like http://localhost:3000\'.',
      "Otherwise it returns the URL's origin, without a trailing slash.",
    ],
    why: "originCheck compares the browser's Origin header with these strings exactly, and a browser's Origin never has a path or a trailing slash, so each entry is reduced to that form at startup. The message repeats the entry, which is not secret.",
    returns: 'The origin string, or z.NEVER after adding an issue.',
    tests: [GATEWAY_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/gateway/src/env-schema.ts#isEd25519PrivateKey',
    status: 'verified',
    summary: 'Says whether a text parses as an Ed25519 private key.',
    why: "It asks Node's createPrivateKey to read the text and checks the key type, the kind `pnpm setup:keys` writes. Anything that fails to parse is simply false, so the settings check reports one clear message instead of a crypto error.",
    returns: 'true or false.',
    tests: [GATEWAY_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/gateway/src/env-schema.ts#serviceUrl',
    status: 'verified',
    summary: 'The Zod schema for each service URL: an http(s) URL, without trailing slashes.',
    why: "proxyToService builds each call as the service URL followed by the service's path, so a trailing slash would double the slash. Any other protocol fails with 'must be an http(s) URL'.",
    returns: 'A Zod schema whose parsed value is the URL text without trailing slashes.',
    tests: [GATEWAY_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
    status: 'verified',
    summary:
      'The only routes the gateway forwards, each with its service, target path and session rule.',
    how: [
      "POST /api/auth/session goes to auth's POST /sessions (Google sign-in); no session needed.",
      "POST /api/auth/dev-session goes to auth's POST /sessions/dev (dev sign-in); no session needed.",
      "DELETE /api/auth/session goes to auth's DELETE /sessions/current (logout); a session is required.",
      "GET /api/me and PATCH /api/me go to auth's GET and PATCH /me; a session is required.",
      "GET and POST /api/chats go to chat's GET and POST /chats (list or search, and create).",
      "GET, PATCH and DELETE /api/chats/:id go to chat's /chats/:id (read, rename or pin, delete), and GET /api/chats/:id/messages to /chats/:id/messages (history).",
      'Every chat route requires a session.',
    ],
    why: "It is an allowlist: anything not listed gets the gateway's own 404 and never reaches a service, so auth's GET /internal/users/:id and chat's /internal routes cannot be called from outside (journey.test.ts checks both, SEC-01). Agent and billing have no entries yet, so nothing reaches them through the gateway.",
    returns: 'A read-only array of eleven PublicRoute entries.',
    tests: [GATEWAY_ROUTE_TABLE_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/gateway/src/route-table.ts#SAFE_PARAM',
    status: 'verified',
    summary: 'The pattern a :param in a public path must match: 1 to 64 letters, digits, - or _.',
    why: "Route params are IDs. Refusing everything else means a dot segment or an encoded slash can never be smuggled into the service's path. The chat routes' :id uses it; a chat ID is a 24-character ObjectId, which fits. An ID with any other character matches no route and gets the gateway's own 404.",
    returns: 'A regular expression.',
    tests: [GATEWAY_ROUTE_TABLE_TEST],
  },
  {
    symbol: 'backend/gateway/src/route-table.ts#segments',
    status: 'verified',
    summary: 'Splits a path into its parts, dropping empty ones.',
    why: 'matchRoute compares paths part by part. Dropping empty parts means /api/me/ and //api/me split the same as /api/me.',
    returns: "An array of strings, such as ['api', 'me'].",
    tests: [GATEWAY_ROUTE_TABLE_TEST],
  },
  {
    symbol: 'backend/gateway/src/route-table.ts#matchRoute',
    status: 'verified',
    summary: 'Finds the public route for a request, and the path to call on its service.',
    how: [
      'It goes through the routes in order, skipping any with another method or another number of path parts.',
      'A plain part must be equal. A :param part takes the value at that place, which must match SAFE_PARAM.',
      "On a match it fills the route's params into its target, giving the service path (/api/chats/<id> becomes /chats/<id>), and throws if the target names a param the public path does not have.",
      'It returns undefined when nothing matches.',
    ],
    why: "The gateway's app calls it for every request that reaches the /api router; undefined means the gateway answers 404 itself. A path with `..` in it does not match any entry, so it never reaches a service either.",
    returns: '{ route, targetPath }, or undefined.',
    tests: [GATEWAY_ROUTE_TABLE_TEST, GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/gateway/src/guards.ts#SAFE_METHODS',
    status: 'verified',
    summary: 'The methods that only read: GET, HEAD and OPTIONS.',
    why: 'originCheck lets these through without an Origin header; every other method changes something, so it must come from the app.',
    returns: 'A Set of three method names.',
    tests: [GATEWAY_GUARDS_TEST],
  },
  {
    symbol: 'backend/gateway/src/guards.ts#originCheck',
    status: 'verified',
    summary:
      'Cross-site request forgery defence: a request that changes something must carry an allowed Origin.',
    how: [
      'GET, HEAD and OPTIONS pass straight through.',
      "Any other method needs an Origin header that is exactly one of the allowed origins (FRONTEND_ORIGIN). Otherwise, missing or not, it passes AppError('forbidden', 'This request must come from the GilderAi app') on, and the client gets 403.",
    ],
    why: "Browsers set Origin themselves and pages cannot fake it, so a form or script on another site cannot act with the user's cookie. Per its comment, the cookie's SameSite=Lax is the first line of defence and this is the second. It runs after the route is matched and before the session lookup, so a refused request costs no Redis read for the session.",
    returns: 'An Express middleware function.',
    tests: [GATEWAY_GUARDS_TEST, GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/gateway/src/guards.ts#sessionLookup',
    status: 'verified',
    summary: 'Finds the session the cookie names and records its user.',
    how: [
      'It reads the session ID from the Cookie header with sessionIdFromCookies.',
      'With an ID, resolveSession looks the session up in Redis and renews its 7 days.',
      'For a valid session it sets `res.locals.userId` and adds the user to the log context.',
      'A missing, malformed or expired session is not an error here; it just leaves no user.',
    ],
    why: 'Each request needs to know its user once, at the gateway; the proxy then names that user in the internal token. Routes that need a session check it afterwards (requireSession), so open routes such as sign-in still work without one.',
    returns: 'An async Express middleware function.',
    sideEffects: [
      "Renews the session's expiry in Redis.",
      'Sets res.locals.userId and the request context user for a valid session.',
    ],
    tests: [GATEWAY_GUARDS_TEST, GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/gateway/src/guards.ts#requireSession',
    status: 'verified',
    summary: 'For routes that need a signed-in user: 401 when the session lookup found none.',
    why: "It stops a request with no valid session at the gateway, before anything is forwarded, with AppError('unauthorized', 'Sign in first'). The app runs it only for routes whose session rule is 'required'. After logout, the old cookie gets this 401 (journey.test.ts).",
    returns: 'An Express middleware function.',
    tests: [GATEWAY_GUARDS_TEST, GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/gateway/src/guards.ts#ipRateLimit',
    status: 'verified',
    summary: 'At most 120 requests a minute from one IP address, signed in or not.',
    why: "It is rateLimit with the scope 'ip', GATEWAY_RATE_LIMITS.perIp and `req.ip` as the key, which `trust proxy` reads from X-Forwarded-For. It runs first in the /api router, so it counts every request that reaches it, including unknown paths, and a client over the limit gets 429 with Retry-After before anything else is done.",
    returns: 'An async Express middleware function.',
    sideEffects: ['Counts the request in Redis under rl:ip:<address>.'],
    tests: [GATEWAY_GUARDS_TEST],
  },
  {
    symbol: 'backend/gateway/src/guards.ts#userRateLimit',
    status: 'verified',
    summary: 'At most 60 requests a minute from one signed-in user, from any number of devices.',
    why: "It is rateLimit with the scope 'user', GATEWAY_RATE_LIMITS.perUser and `res.locals.userId` as the key. It runs after sessionLookup, so a request with no session is not counted here and only the per-IP limit applies to it.",
    returns: 'An async Express middleware function.',
    sideEffects: ['Counts the request in Redis under rl:user:<user ID>, when there is a user.'],
    tests: [GATEWAY_GUARDS_TEST],
  },
  {
    symbol: 'backend/gateway/src/proxy.ts#FORWARDED_REQUEST_HEADERS',
    status: 'verified',
    summary: 'The request headers a service may see.',
    why: 'Only Content-Type, Accept, Accept-Language and User-Agent are passed on. Everything else, such as Origin and other browser headers, stays at the gateway. The proxy adds X-Request-Id and the internal token itself, and the cookie only for auth.',
    returns: "['content-type', 'accept', 'accept-language', 'user-agent']",
    tests: [GATEWAY_PROXY_TEST],
  },
  {
    symbol: 'backend/gateway/src/proxy.ts#FORWARDED_RESPONSE_HEADERS',
    status: 'verified',
    summary: "The service's response headers passed back to the browser.",
    why: 'Only Content-Type, Cache-Control, Retry-After and Location are copied; Set-Cookie is copied separately, every one of them. Per its comment, hop-by-hop headers, Content-Length and Content-Encoding are left out, because Node sets the framing of the streamed body itself.',
    returns: "['content-type', 'cache-control', 'retry-after', 'location']",
    tests: [GATEWAY_PROXY_TEST],
  },
  {
    symbol: 'backend/gateway/src/proxy.ts#proxyToService',
    status: 'verified',
    summary:
      'Forwards a matched request to its service with a fresh internal token, and streams the answer back.',
    how: [
      "The URL is the service's URL, the matched target path and the original query string.",
      'It copies the allowed request headers, sets X-Request-Id to the request ID, and signs an internal token with signInternalToken: the audience is the service, the subject is the user when sessionLookup found one, and `rid` is the request ID.',
      'It passes the Cookie header only to auth, which owns the session cookie.',
      "It calls fetch with the method, the raw body when there is one and `redirect: 'manual'`. An AbortController stops the call if the service has not started answering within 10 seconds, or if the client disconnects before the response is finished.",
      "If fetch fails and the client is still there, it throws AppError('service_unavailable'): 'The <service> service did not answer in time' after a timeout, otherwise 'The <service> service is not reachable'. The client gets a 503, and errorHandler logs the error as 'request failed'.",
      'Otherwise it copies the status and the allowed response headers, sets every Set-Cookie header the service sent, and pipes the body back chunk by chunk, or ends the response when there is no body. A stream error destroys the response.',
    ],
    why: "The browser never talks to a service directly. A new token per request proves the request came through the gateway and says which user it is for, and it expires after 60 seconds. Streaming lets a long answer reach the browser as it is written. The service's own status and error body pass through unchanged.",
    returns: 'An async Express middleware function.',
    sideEffects: [
      'Sends an HTTP request to a service.',
      'Writes the status, headers and body of the response.',
    ],
    tests: [GATEWAY_PROXY_TEST, GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/auth/src/app.ts#createApp',
    status: 'verified',
    summary:
      "Builds the auth service's Express app: sign-in, logout and the user's profile, behind the internal-token check.",
    how: [
      "It calls createService with the name 'auth', the given logger and readiness checks, and `internalAuth: { publicKey, audience: 'auth' }`. Every route except /healthz and /readyz then needs a valid internal token addressed to auth, so a direct call gets 401.",
      'Its routes add sessionRouter, given the Redis client, the Google sign-in check, devLogin, secureCookie and the logger, then meRouter.',
      'So it serves POST /sessions, POST /sessions/dev (only when devLogin is on), DELETE /sessions/current, GET and PATCH /me and GET /internal/users/:id. An unknown path with a valid token gets 404.',
      'At startup, index.ts passes two readiness checks (mongo and redis), the imported INTERNAL_PUBLIC_KEY, the Redis client, the Google sign-in check (createFirebaseVerifier, or googleSignInNotSetUp when the Firebase settings are empty), AUTH_DEV_LOGIN as devLogin, and secureCookie on when NODE_ENV is production.',
    ],
    why: "Building the app apart from starting it lets tests get the app without startService or a fixed port; supertest serves it on a temporary port. Everything it needs is passed in, so auth's app.test.ts uses a silent logger, a fake readiness check, a test Redis, a key pair made for the test and googleSignInNotSetUp. The gateway signs the tokens and forwards the public sign-in, logout and /me routes to it; journey.test.ts runs this app on a port behind the real gateway.",
    returns:
      'An Express app with /healthz and /readyz open to all, the session and /me routes behind the internal-token check, and the shared 404 and error handling.',
    tests: [AUTH_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/auth/src/env.ts#env',
    status: 'verified',
    summary: "The auth service's environment variables, checked at startup.",
    how: [
      'It is one line, `loadEnv(authEnvSchema)`: the settings and the rules between them live in env-schema.ts.',
      'loadEnv checks process.env against that schema when the file is first imported.',
    ],
    why: 'The service refuses to start if a setting is missing or invalid, before it connects to anything. It needs MONGODB_URI, REDIS_URL and INTERNAL_PUBLIC_KEY. AUTH_DEV_LOGIN (default false) and the three Firebase settings for Google sign-in are optional, except that production needs AUTH_DEV_LOGIN off and all three Firebase settings. PORT, NODE_ENV and LOG_LEVEL have defaults. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads all of it: the log level, NODE_ENV (pretty logs in development, a Secure session cookie in production), the MongoDB and Redis URLs, the internal public key, the dev sign-in flag, the three Firebase settings (to pick the Google sign-in check) and the port.',
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
      "INTERNAL_PUBLIC_KEY, the gateway's public key for checking internal tokens, uses the shared internalPublicKeySchema: it is required, escaped `\\n` line breaks are turned back into real ones, and it must start with -----BEGIN PUBLIC KEY-----. Both of its messages say to run `pnpm setup:keys`, and neither repeats the value.",
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
    status: 'verified',
    summary: 'The Firebase error codes that mean the sign-in token itself is no good.',
    why: "auth/argument-error, auth/invalid-id-token, auth/id-token-expired, auth/id-token-revoked, auth/user-disabled and auth/user-not-found all mean the user has to sign in again, so they become a 401. Any other failure, such as a wrong service account or Firebase being unreachable, is the server's problem and stays a 500, so users are never blamed for an outage.",
    returns: 'A Set of six error codes.',
    tests: [AUTH_FIREBASE_TEST],
  },
  {
    symbol: 'backend/services/auth/src/firebase.ts#verifierFrom',
    status: 'verified',
    summary: 'Checks a Google sign-in ID token and returns who signed in.',
    how: [
      'It calls verifyIdToken(token, true): `true` also asks Firebase whether the token was revoked, for example after the account was disabled.',
      "A FirebaseAuthError whose code is in REJECTED_TOKEN_CODES becomes AppError('unauthorized'), 'The Google sign-in is not valid. Sign in again.', with Firebase's error as its cause. Any other error is thrown again unchanged.",
      "The token must carry an email with email_verified true; otherwise it is a 401, 'The Google account has no verified email address'.",
      'It returns firebaseUid and email, plus name and avatarUrl when the account has them.',
    ],
    why: "The browser sends the token it got from Firebase, so auth must check it before trusting who the user is. It takes the checker as an argument, so tests can pass a fake. createFirebaseVerifier builds the real one, which auth's POST /sessions calls when the Firebase settings are set.",
    returns:
      'A function from an ID token to a promise of { firebaseUid, email, name?, avatarUrl? }.',
    tests: [AUTH_FIREBASE_TEST],
  },
  {
    symbol: 'backend/services/auth/src/firebase.ts#createFirebaseVerifier',
    status: 'verified',
    summary: 'Builds the real token check from a Firebase service account.',
    how: [
      "It starts a firebase-admin app named 'gilder-auth' with the project ID, client email and private key from auth's settings.",
      "It passes that app's Auth to verifierFrom.",
    ],
    why: "Google sign-in needs the project's own Firebase service account. A test builds one with a throwaway key for a made-up project and checks that a malformed token gets a 401 from the real SDK, which rejects it without using the network. Auth's index.ts calls it at startup when all three FIREBASE_* settings are set.",
    returns: 'The verifier from verifierFrom.',
    tests: [AUTH_FIREBASE_TEST],
  },
  {
    symbol: 'backend/services/auth/src/firebase.ts#googleSignInNotSetUp',
    status: 'verified',
    summary: 'The token check to use when the Firebase settings are not set.',
    why: "Outside production the Firebase settings are optional. Google sign-in then answers 503 service_unavailable, while dev sign-in still works. Because it is a 5xx, the client sees only 'Service unavailable'; the message 'Google sign-in is not set up on this server' is in auth's error log. Auth's index.ts uses it when the FIREBASE_* settings are empty, and then logs the warning 'Google sign-in is not set up: the FIREBASE_* settings are empty' at startup.",
    returns: 'A function that always rejects with that 503 error.',
    tests: [AUTH_FIREBASE_TEST, AUTH_TEST],
  },
  {
    symbol: 'backend/services/auth/src/me-routes.ts#currentUser',
    status: 'verified',
    summary: 'Loads the user the internal token names.',
    why: "A session can outlive its user, for example after the account was deleted. Then the user is gone, and that is a 401, 'This account no longer exists', so the browser treats it as signed out.",
    returns: 'A promise of the user document.',
    tests: [AUTH_ME_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/auth/src/me-routes.ts#meRouter',
    status: 'verified',
    summary: "The signed-in user's own profile, and the user lookup for other services.",
    how: [
      'GET /me returns { user } with toProfile for the user in the internal token.',
      'PATCH /me takes { themePreference } (system, light or dark) and saves it. The body schema is strict, so any other field is a 400 instead of being ignored.',
      "GET /internal/users/:id returns the user only when :id is the token's own user. Another user's ID gets the same 404 as an unknown one, so the route can't reveal which accounts exist. A malformed ID is a 400.",
      'Every route needs a user in the internal token (requireUser), so a request with no session is a 401.',
    ],
    why: "A user only ever sees and changes their own account. The internal route is how other services will look up the user a request is for. Auth's createApp adds the router behind the internal-token check, so a direct call gets 401. The gateway forwards GET and PATCH /api/me here. GET /internal/users/:id is not in its route table, so it cannot be reached from outside, and no service calls it yet.",
    returns: 'An Express Router.',
    sideEffects: ['PATCH /me updates the user in MongoDB.'],
    tests: [AUTH_ME_ROUTES_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/auth/src/session-routes.ts#COOKIE_MAX_AGE_MS',
    status: 'verified',
    summary: 'How long the browser keeps the session cookie: 30 days.',
    why: 'Redis ends a session after 7 days without use (SESSION_TTL_SECONDS, renewed on every lookup), so an idle user is signed out after a week. The cookie limit caps even an active session at 30 days, after which the user signs in again.',
    returns: '2,592,000,000 milliseconds.',
    tests: [AUTH_SESSION_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter',
    status: 'verified',
    summary: 'The sign-in and logout routes: auth creates sessions, sets the cookie and ends them.',
    how: [
      'POST /sessions takes { idToken }, checks it with verifyIdToken, finds or makes the user with upsertGoogleUser and starts a session.',
      'POST /sessions/dev takes { email, name? } and does the same with findOrCreateDevUser. It is added only when devLogin is on, so without it the path is a 404.',
      "Starting a session creates it in Redis, sets the gilder_sid cookie (HttpOnly, SameSite=Lax, Path=/, Max-Age 30 days, plus Secure when secureCookie is on), records the user in the request context, logs 'signed in' with the method and whether the user is new, and answers { user } with toProfile.",
      'DELETE /sessions/current needs a user in the internal token (requireUser). It deletes the session the cookie names, clears the cookie and answers 204. Calling it twice, or without a cookie, still gives 204.',
      'Request bodies are checked with validate, so a missing token or a bad email is a 400.',
    ],
    why: "One service owns sessions end to end, so the cookie settings live in one place. Auth's createApp adds the router behind the internal-token check. The gateway maps POST /api/auth/session, POST /api/auth/dev-session and DELETE /api/auth/session onto these paths and passes the Set-Cookie headers back to the browser.",
    returns: 'An Express Router.',
    sideEffects: [
      'Writes and deletes session keys in Redis.',
      'Creates and updates users in MongoDB.',
      'Sets and clears the session cookie.',
    ],
    tests: [AUTH_SESSION_ROUTES_TEST, AUTH_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#upsertGoogleUser',
    status: 'verified',
    summary: 'Finds the user for a Google sign-in, or makes one.',
    how: [
      'By Firebase ID first: the same ID is the same user, and its email, name and avatar are refreshed (a name or avatar the sign-in leaves out is kept).',
      'Then by email: a verified email already on file under another ID belongs to the same person, for example after the Firebase account was recreated or a local dev sign-in used it, so that user gets the new Firebase ID.',
      'Otherwise it creates the user. If a second sign-in creates the same user at the same moment, the unique index makes one fail, and that one finds the user the other made.',
    ],
    why: 'Sign-in must never create two accounts for one person. `created` tells the caller about a first sign-in, which the credits grant will need. Only the Google sign-in route (POST /sessions) calls it.',
    returns: 'A promise of { user, created }.',
    sideEffects: ['Creates or updates a user in MongoDB.'],
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#findOrCreateDevUser',
    status: 'verified',
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
    status: 'verified',
    summary: "The themes a user can pick: 'system', 'light' or 'dark'.",
    why: "'system' follows the device's light or dark setting and is the default. The list types ThemePreference and limits the users model's themePreference field. PATCH /me checks the new theme against it.",
    returns: "A read-only array: 'system', 'light', 'dark'.",
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#userSchema',
    status: 'verified',
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
    status: 'verified',
    summary: 'The Mongoose model for the users collection in the auth database (gilder_auth).',
    why: 'Only auth reads or writes users; other services will ask auth over HTTP. It is built from the `mongoose` that @gilder/shared re-exports, so it uses the connection connectMongo opens. Mongoose creates the unique indexes when the model first connects. The sign-in routes use it through upsertGoogleUser and findOrCreateDevUser, and the /me routes read and save users with it.',
    returns: 'A Mongoose model of User documents.',
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/auth/src/users.ts#toProfile',
    status: 'verified',
    summary: 'Turns a user document into what the API shows of a user.',
    how: [
      'It returns id, email, name, avatarUrl and themePreference.',
      'A name or avatar that is not set becomes null, so the shape is always the same.',
      'The Firebase ID is left out: it stays inside auth.',
    ],
    why: 'One function decides what leaves the service, so a new field in the model is never sent by accident. Every auth route that answers with a user goes through it.',
    returns: '{ id, email, name, avatarUrl, themePreference }',
    tests: [AUTH_USERS_TEST],
  },
  {
    symbol: 'backend/services/chat/src/app.ts#createApp',
    status: 'verified',
    summary:
      "Builds the chat service's Express app: the chat routes and the internal routes, behind the internal-token check.",
    how: [
      "It calls createService with the name 'chat', the given logger and readiness checks, `internalAuth: { publicKey: internalPublicKey, audience: 'chat' }`, and routes that add chatRouter, then internalRouter.",
      'So it serves GET and POST /chats, GET, PATCH and DELETE /chats/:id, GET /chats/:id/messages, and the five /internal routes for the agent service.',
      "Per its comment, only the gateway's token gets past the health checks, so a direct call gets 401 on any path. An unknown path with a valid token gets 404.",
      'At startup, index.ts passes one readiness check, mongo, and the imported INTERNAL_PUBLIC_KEY.',
    ],
    why: 'Building the app apart from starting it lets tests get the app without startService or a fixed port; supertest serves it on a temporary port, and the route tests start a MongoDB of their own (startTestMongo) and sign their own tokens. Its app.test.ts sends missing, garbage, forged, misaddressed and expired tokens and checks each gets 401 (SEC-02). The package exports it as @gilder/chat/app, so journey.test.ts runs this app on a port behind the real gateway, which forwards the six /api/chats routes to it.',
    returns:
      'An Express app with /healthz and /readyz open to all, the chat and internal routes behind the internal-token check, and the shared 404 and error handling.',
    tests: [CHAT_TEST, CHAT_ROUTES_TEST, CHAT_INTERNAL_ROUTES_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/chat/src/env.ts#env',
    status: 'verified',
    summary: "The chat service's environment variables, checked at startup.",
    how: [
      'It extends baseEnvSchema with PORT (default 8002), MONGODB_URI (required, not empty) and INTERNAL_PUBLIC_KEY (the shared internalPublicKeySchema).',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The service refuses to start if MONGODB_URI or INTERNAL_PUBLIC_KEY is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB URL, the public key and the port.',
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI and INTERNAL_PUBLIC_KEY.',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },

  // -------------------------------------------------------------------------------------------
  // backend/services/chat: conversations, messages and their routes

  {
    symbol: 'backend/services/chat/src/models.ts#DEFAULT_CHAT_TITLE',
    status: 'verified',
    summary: "The title a chat starts with: 'New chat'.",
    why: "conversationSchema uses it as the title's default. The auto-title route (PATCH /internal/chats/:id) renames a chat only while its title is still this, so a title the user chose is never overwritten.",
    returns: "The string 'New chat'.",
    tests: [CHAT_MODELS_TEST, CHAT_INTERNAL_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#MESSAGE_ROLES',
    status: 'verified',
    summary: "Who can write a message: 'user' or 'assistant'.",
    why: "The messages model accepts only these roles, and POST /internal/messages checks the role against the same list, so a 'system' message is refused in both places. `as const` keeps the exact names for the MessageView type.",
    returns: "A read-only array: 'user', 'assistant'.",
    tests: [CHAT_MODELS_TEST, CHAT_INTERNAL_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#MESSAGE_STATUSES',
    status: 'verified',
    summary: "The states of a message: 'streaming', 'complete', 'stopped' or 'failed'.",
    why: "A message saved as 'streaming' is filled in later with PATCH /internal/messages/:id. Only 'complete' and 'stopped' messages count as an agent's memory (recent-messages), and the chat page shows 'Stopped' or 'This answer failed.' under such answers. A message is 'complete' unless told otherwise.",
    returns: 'A read-only array of the four statuses.',
    tests: [CHAT_MODELS_TEST, CHAT_INTERNAL_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#conversationSchema',
    status: 'verified',
    summary: 'The shape and rules of a document in the conversations collection.',
    how: [
      'userId (the owner) is required.',
      "title is trimmed, at most 120 characters, and starts as 'New chat'.",
      'pinnedAt is null unless the chat is pinned; lastMessageAt is set to now when the chat is made and moves with each new message; deletedAt is null unless the chat was deleted.',
      'timestamps adds createdAt and updatedAt.',
      'Two indexes come with it: { userId, pinnedAt: -1, lastMessageAt: -1 } for the chat list, and a text index on title after userId for search. With userId first, MongoDB needs an exact userId in every text search, so a search cannot run across users.',
    ],
    why: "Everything the list, search and soft delete need is on the chat itself, so the list is two simple queries. Every query filters by userId and deletedAt: null, so other users' chats and deleted ones never come back.",
    tests: [CHAT_MODELS_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#messageSchema',
    status: 'verified',
    summary: 'The shape and rules of a document in the messages collection.',
    how: [
      'conversationId and userId are required: each message carries its owner too.',
      'role is one of MESSAGE_ROLES, status one of MESSAGE_STATUSES (default complete), and agent, when set, one of AGENTS.',
      'clientMessageId (at most 64 characters) is chosen by the browser for each send.',
      'supersededBy is set when an edit or a regenerate replaces the message; such messages stay, hidden.',
      'attachments and fileRefs hold file IDs, never URLs. artifacts, sources and citations are filled in by the agents.',
      'Indexes: { conversationId, createdAt } for a chat in order; { conversationId, clientMessageId }, unique only where clientMessageId is set, so one send is saved once; and a text index on content after userId for search.',
    ],
    why: 'With the owner on each message, message search and PATCH /internal/messages/:id filter by user without reading the chat first. The unique index is what makes a retried send safe even when two copies arrive at once.',
    tests: [CHAT_MODELS_TEST, CHAT_INTERNAL_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#ConversationModel',
    status: 'verified',
    summary:
      "The Mongoose model for the conversations collection in chat's database (gilder_chat).",
    why: 'Only chat reads or writes chats. It is built from the mongoose that @gilder/shared re-exports, so it uses the connection connectMongo opens; Mongoose builds the indexes when the model first connects (the tests wait for that with init()). chatRouter lists, searches, creates, renames, pins and soft-deletes chats with it, and findOwnedConversation reads one.',
    returns: 'A Mongoose model of Conversation documents.',
    tests: [CHAT_MODELS_TEST, CHAT_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#MessageModel',
    status: 'verified',
    summary: "The Mongoose model for the messages collection in chat's database.",
    why: 'chatRouter reads the history and searches message text with it; internalRouter saves, replaces and fills in messages. Mongoose builds the unique and text indexes when the model first connects.',
    returns: 'A Mongoose model of Message documents.',
    tests: [CHAT_MODELS_TEST, CHAT_ROUTES_TEST, CHAT_INTERNAL_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#findOwnedConversation',
    status: 'verified',
    summary:
      "The chat with this ID, only if it belongs to the user and isn't deleted; otherwise null.",
    how: [
      'An ID that is not a valid ObjectId gives null without a query.',
      'Otherwise one findOne filters by _id, userId and deletedAt: null.',
    ],
    why: "Every route that reads or changes one chat goes through it, so someone else's chat, a deleted one, a missing one and a malformed ID all look the same: null, which the routes turn into the same 404 'No such chat' (SEC-04). The owner check is part of the query, so no route can read a chat and forget to check it.",
    returns: 'A promise of the conversation document, or null.',
    tests: [CHAT_MODELS_TEST, CHAT_ROUTES_TEST, CHAT_INTERNAL_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#toChat',
    status: 'verified',
    summary: 'Turns a conversation document into what the API shows of a chat.',
    how: [
      'It returns id, title, pinned, lastMessageAt and createdAt.',
      'pinned is true when pinnedAt is set; the pin time itself is not sent.',
      'Dates go out as ISO strings.',
    ],
    why: "One function decides what leaves the service: userId and deletedAt never do. The frontend's ChatSummary type has the same shape.",
    returns: '{ id, title, pinned, lastMessageAt, createdAt }',
    tests: [CHAT_MODELS_TEST, CHAT_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/models.ts#toMessage',
    status: 'verified',
    summary: 'Turns a message document into what the API shows of a message.',
    how: [
      'It returns id, role, content, agent, status, clientMessageId, attachments, artifacts, sources, citations and createdAt.',
      'An agent or clientMessageId that is not set becomes null, so the shape is always the same.',
      'userId, conversationId, supersededBy and fileRefs stay inside the service.',
    ],
    why: "As with toChat, what leaves the service is chosen in one place. The frontend's ChatMessage type has the same shape.",
    returns:
      '{ id, role, content, agent, status, clientMessageId, attachments, artifacts, sources, citations, createdAt }',
    tests: [CHAT_MODELS_TEST, CHAT_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/chat-routes.ts#encodeCursor',
    status: 'verified',
    summary: 'Packs a page position into an opaque cursor.',
    why: 'A cursor is the sort value (at, an ISO time) and the ID of the last item on a page, as JSON in base64url, so it is safe in a URL. The next page starts right after that item, so chats added in the meantime do not shift the pages. GET /chats uses lastMessageAt and GET /chats/:id/messages uses createdAt.',
    returns: 'A base64url string.',
    tests: [CHAT_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/chat-routes.ts#decodeCursor',
    status: 'verified',
    summary: 'Reads a cursor back, or refuses it with 400.',
    how: [
      'No cursor gives undefined: the first page.',
      'Otherwise it decodes base64url and parses the JSON, and accepts only { at, id } where at is a date and id a valid ObjectId.',
      "Anything else, text that is not JSON included, throws AppError('bad_request', 'The cursor is not valid').",
    ],
    why: "The cursor's values go straight into a MongoDB query, so a cursor the service did not make is refused before it can shape one.",
    returns: '{ at, id }, or undefined.',
    tests: [CHAT_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/chat-routes.ts#ownedOr404',
    status: 'verified',
    summary: "The user's own chat, or the 404 'No such chat'.",
    why: "chatRouter's routes for one chat start with it, passing the user from the internal token. When findOwnedConversation finds nothing it throws AppError('not_found', 'No such chat'), so a chat that is someone else's answers exactly like one that never existed.",
    returns: 'A promise of the conversation document.',
    tests: [CHAT_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/chat/src/chat-routes.ts#chatRouter',
    status: 'verified',
    summary:
      "The signed-in user's chats: list, search, create, rename, pin, delete and read the history.",
    how: [
      'Every /chats route needs a user in the internal token (requireUser), and checks its params, query and body with validate.',
      'GET /chats without a query: the first page holds every pinned chat (latest pin first, up to 50), then up to `limit` others (default 30, at most 50), newest lastMessageAt first with _id as the tie-break. nextCursor points after the last of those, or is null. A page with a cursor holds no pinned chats.',
      "GET /chats?query= searches titles and the text of the user's messages that are not superseded, at the same time, up to 50 chats each. It merges them without repeats, leaves out deleted chats, sorts by lastMessageAt and returns up to `limit`, with nextCursor null.",
      "POST /chats makes a chat, titled 'New chat' unless a title is given, and answers 201 { chat }.",
      'GET /chats/:id answers { chat }. PATCH /chats/:id takes a title, pinned or both; pinning keeps an existing pin time. DELETE /chats/:id sets deletedAt and answers 204.',
      'GET /chats/:id/messages pages from the newest message back, skipping superseded ones; each page comes back oldest first, with a cursor for the older page.',
      "The routes for one chat go through ownedOr404, so another user's chat gets the same 404 'No such chat' as a missing one.",
    ],
    why: 'Each user only ever sees and changes their own chats. createApp mounts it behind the internal-token check, and the gateway forwards its six routes from /api/chats. The sidebar list, search, rename, pin and delete call it through RTK Query, and the chat page reads GET /chats/:id and its messages on the server. POST /chats is in place for the first message to create a chat; nothing in the frontend calls it yet.',
    returns: 'An Express Router.',
    sideEffects: [
      'POST creates a conversation, PATCH changes its title or pinnedAt, and DELETE sets its deletedAt, in MongoDB.',
    ],
    tests: [CHAT_ROUTES_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/chat/src/internal-routes.ts#internalRouter',
    status: 'not-wired',
    summary:
      'Routes for the agent service: read a chat, auto-title it, read its recent messages, and save and fill in messages.',
    how: [
      "Every /internal route needs a user in the internal token (requireUser), and every lookup filters by that user, so another user's chat or message gets a 404.",
      'GET /internal/chats/:id answers { chat }.',
      "PATCH /internal/chats/:id takes { title } and renames the chat only while its title is still 'New chat'. It answers { chat, renamed }.",
      'GET /internal/chats/:id/recent-messages returns the latest complete or stopped messages that are not superseded, oldest first: 20 by default, at most 50.',
      'POST /internal/messages saves a message, with up to 100,000 characters of text. If the chat already has a message with the same clientMessageId, it answers 200 with that message and created: false. If two copies race past that check, the unique index keeps one and the other answers with it.',
      "A new message answers 201 with created: true. It hides the messages listed in supersedes (valid IDs in the same chat only) and moves the chat's lastMessageAt to it.",
      "PATCH /internal/messages/:id fills in content, status, agent, attachments, artifacts, sources or citations; at least one, and nothing else. Once the status is no longer 'streaming', the chat's lastMessageAt moves to now.",
    ],
    why: "These are the calls the agent service is to make while it answers: check the chat, read its memory, save the user's message and the answer, and name the chat. The gateway's route table has no /internal entries, so they cannot be reached from outside (journey.test.ts, SEC-01). Nothing calls them yet.",
    returns: 'An Express Router.',
    sideEffects: [
      "Creates and updates messages, and changes a chat's title and lastMessageAt, in MongoDB.",
    ],
    tests: [CHAT_INTERNAL_ROUTES_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/agent/src/app.ts#createApp',
    status: 'verified',
    summary:
      "Builds the agent service's Express app: no routes of its own yet, but locked behind the internal-token check.",
    how: [
      "It calls createService with the name 'agent', the given logger and readiness checks, and `internalAuth: { publicKey: internalPublicKey, audience: 'agent' }`.",
      "Its comment says it has no routes of its own yet, but is locked already: only the gateway's token gets past the health checks, so a direct call gets 401 on any path. A request with a valid token gets 404, since there are no routes.",
      'At startup, index.ts passes two readiness checks: mongo and redis, and the imported INTERNAL_PUBLIC_KEY.',
    ],
    why: "Building the app apart from starting it lets tests get the app without startService, a fixed port or real databases; supertest serves it on a temporary port. Its app.test.ts sends missing, garbage, forged, misaddressed and expired tokens and checks each gets 401 (SEC-02). The gateway's route table has no agent routes yet, so nothing reaches it through the gateway.",
    returns:
      'An Express app with /healthz and /readyz open to all, the internal-token check in front of everything else, and the shared 404 and error handling.',
    tests: [AGENT_TEST],
  },
  {
    symbol: 'backend/services/agent/src/env.ts#env',
    status: 'verified',
    summary: "The agent service's environment variables, checked at startup.",
    how: [
      'It extends baseEnvSchema with PORT (default 8003), MONGODB_URI and REDIS_URL (both required, not empty) and INTERNAL_PUBLIC_KEY (the shared internalPublicKeySchema).',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The service refuses to start if MONGODB_URI, REDIS_URL or INTERNAL_PUBLIC_KEY is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB and Redis URLs, the public key and the port.',
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI, INTERNAL_PUBLIC_KEY and REDIS_URL.',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/services/billing/src/app.ts#createApp',
    status: 'verified',
    summary:
      "Builds the billing service's Express app: no routes of its own yet, but locked behind the internal-token check.",
    how: [
      "It calls createService with the name 'billing', the given logger and readiness checks, and `internalAuth: { publicKey: internalPublicKey, audience: 'billing' }`.",
      "Its comment says it has no routes of its own yet, but is locked already: only the gateway's token gets past the health checks, so a direct call gets 401 on any path. A request with a valid token gets 404, since there are no routes.",
      'At startup, index.ts passes one readiness check: mongo, and the imported INTERNAL_PUBLIC_KEY.',
    ],
    why: "Building the app apart from starting it lets tests get the app without startService, a fixed port or real databases; supertest serves it on a temporary port. Its app.test.ts sends missing, garbage, forged, misaddressed and expired tokens and checks each gets 401 (SEC-02). The gateway's route table has no billing routes yet, so nothing reaches it through the gateway.",
    returns:
      'An Express app with /healthz and /readyz open to all, the internal-token check in front of everything else, and the shared 404 and error handling.',
    tests: [BILLING_TEST],
  },
  {
    symbol: 'backend/services/billing/src/env.ts#env',
    status: 'verified',
    summary: "The billing service's environment variables, checked at startup.",
    how: [
      'It extends baseEnvSchema with PORT (default 8004), MONGODB_URI (required, not empty) and INTERNAL_PUBLIC_KEY (the shared internalPublicKeySchema).',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The service refuses to start if MONGODB_URI or INTERNAL_PUBLIC_KEY is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB URL, the public key and the port.',
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI and INTERNAL_PUBLIC_KEY.',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },

  // -------------------------------------------------------------------------------------------
  // frontend: pages, the /api proxy, the login gate, theme and security headers

  {
    symbol: 'frontend/src/app/layout.tsx#RootLayout',
    status: 'verified',
    summary: 'The root layout of the Next.js app: the <html> and <body> around every page.',
    how: [
      'Next.js uses it because of its file name, src/app/layout.tsx; no project code calls it.',
      'It sets lang="en" and puts the Geist Sans and Geist Mono font variables on <html> as classes.',
      'It renders the current page inside <body>.',
      'The same file imports globals.css and exports metadata: the title GilderAi (pages add their own, as in "Sign in · GilderAi").',
      'suppressHydrationWarning on <html>, because the theme script may set data-theme before React loads.',
    ],
    why: "Next.js's App Router needs a root layout that renders <html> and <body>. This one also adds the theme script in <head> and Providers (the Redux store, tooltips and toasts) around every page.",
    returns: 'The <html> element that wraps every page.',
  },
  {
    symbol: 'frontend/src/app/(app)/page.tsx#NewChatPage',
    status: 'verified',
    summary: 'The page at /: an empty new chat, with a short heading for now.',
    why: 'The signed-in home page, inside the app shell. The composer that starts a chat comes with AI answers.',
    returns: 'The page as JSX.',
  },
  {
    symbol: 'frontend/src/server/gateway-proxy.ts#forwardToGateway',
    status: 'verified',
    summary: 'Forwards one browser request to the gateway and streams the answer back.',
    how: [
      'The target is GATEWAY_URL plus the same /api path and query.',
      'Only accept, accept-language, content-type, cookie, origin, user-agent and x-forwarded-for go along; the gateway needs the cookie for sessions, Origin for its CSRF check and the forwarded address for its per-IP limit.',
      "It keeps the browser's X-Request-Id when it looks safe and otherwise makes one, and adds x-gilder-client: web.",
      "The body is read whole (calls are small JSON), and the request's abort signal is passed on, so a closed tab cancels the gateway call.",
      'The answer comes back with its status, a few headers and every Set-Cookie header, its body streamed as it arrives.',
      'If the gateway cannot be reached, it answers 503 problem+json with the request ID.',
    ],
    why: "The browser never sees a backend address or secret, and the session cookie belongs to the frontend's own domain because Set-Cookie comes back from it.",
    returns: 'A Response.',
    tests: ['frontend/src/server/gateway-proxy.test.ts'],
  },
  {
    symbol: 'frontend/src/proxy.ts#proxy',
    status: 'verified',
    summary: 'The login gate: no session cookie on an app page means a redirect to /login.',
    why: 'It checks only that the cookie is there, before the page renders; the app layout then confirms the session with the gateway. It runs for /, /c/... and /settings/... only, never for /login, /api or static files.',
    returns: 'A redirect to /login, or NextResponse.next().',
    tests: ['frontend/src/proxy.test.ts'],
  },
  {
    symbol: 'frontend/src/server/session.ts#getCurrentUser',
    status: 'verified',
    summary: 'The signed-in user for server components, or null.',
    how: [
      "It asks gatewayGet for /api/me, which calls the gateway directly with the browser's cookies.",
      'With no gilder_sid cookie gatewayGet returns null without calling the gateway, and so does this.',
      'A 401 means the session ended: null. Any other failure throws.',
      "React's cache() runs it at most once per request, so the sidebar and the small-screen bar share one call.",
    ],
    why: 'Reading cookies makes rendering per-request, so callers sit inside a Suspense boundary and the rest of the page stays prerendered. SidebarAccount calls it and sends a visitor without a valid session to /login.',
    returns: 'A promise of the profile or null.',
    tests: [FRONTEND_SESSION_TEST],
  },
  {
    symbol: 'frontend/src/server/security-headers.ts#contentSecurityPolicy',
    status: 'verified',
    summary: 'The Content-Security-Policy every page is sent with.',
    how: [
      "Scripts: the app, 'unsafe-inline' (Next.js inlines its bootstrap scripts), Google's sign-in script and Razorpay checkout; 'unsafe-eval' in development only.",
      'object-src none, base-uri and form-action self, frame-ancestors none, and connect-src and frame-src limited to the services the app uses.',
      'upgrade-insecure-requests outside development.',
    ],
    why: "A nonce would force every page to render per request, which rules out the prerendered shells. The policy never adds a hash or nonce, which would switch 'unsafe-inline' off and break Next.js's own scripts.",
    returns: 'The policy as one header value.',
    tests: ['frontend/src/server/security-headers.test.ts'],
  },
  {
    symbol: 'frontend/src/theme/theme.ts#THEME_SCRIPT',
    status: 'verified',
    summary: 'The script in <head> that applies a saved theme before the first paint.',
    why: "It reads the gilder_theme cookie and sets data-theme on <html> only for 'light' or 'dark'; anything else leaves the theme to the system. A script rather than a server-side cookie read keeps pages prerendered.",
    returns: 'The script as a string.',
    tests: ['frontend/src/theme/theme.test.ts'],
  },
  {
    symbol: 'frontend/src/app/login/login-form.tsx#LoginForm',
    status: 'verified',
    summary: 'The sign-in buttons: Google, and dev sign-in in development builds.',
    how: [
      'Google: the Firebase popup returns an ID token, which is posted to /api/auth/session. The button is disabled until the Firebase web config is set.',
      'Dev sign-in: posts { email } to /api/auth/dev-session.',
      'On success it goes to /. A failure shows a toast with the request reference; closing the Google popup shows nothing.',
    ],
    why: 'One form for both ways in, so sessions start the same way whichever is used.',
    returns: 'The form as JSX.',
    tests: ['frontend/src/app/login/login-form.test.tsx'],
  },

  // -------------------------------------------------------------------------------------------
  // frontend: the app shell, providers and dialog

  {
    symbol: 'frontend/src/app/providers.tsx#Providers',
    status: 'verified',
    summary: 'The client-side providers around every page: the Redux store, tooltips and toasts.',
    why: 'RootLayout wraps every page in it. StoreProvider is outermost, so every client component can use the RTK Query hooks; TooltipProvider sets the tooltip timing; ToastProvider lets any component show a toast.',
    returns: 'The providers as JSX.',
  },
  {
    symbol: 'frontend/src/app/(app)/layout.tsx#AppLayout',
    status: 'verified',
    summary:
      'The signed-in app: the sidebar (a top bar on small screens) and the page, inside ChatCommands.',
    how: [
      'ChatCommands wraps everything, so ⌘K and ⌘⇧O work on every signed-in page and every search button opens the same dialog.',
      'The account parts of the sidebar and of the top bar (SidebarAccount) each sit in a Suspense boundary with a skeleton, because they read the session.',
      'The page goes in <main>, which scrolls on its own.',
    ],
    why: 'Everything outside those boundaries is static, so the shell can be prerendered and the account streams in. The chat list loads later, in the browser.',
    returns: 'The layout as JSX.',
  },
  {
    symbol: 'frontend/src/components/app-shell/sidebar.tsx#SidebarFrame',
    status: 'verified',
    summary:
      'The sidebar on medium and larger screens: brand, New chat, Search chats, the chat list and the account part.',
    why: 'New chat is a link to /, which creates nothing: an empty new chat. SearchButton opens the search dialog and ChatList loads the chats in the browser. The account part comes in as children, because it needs the session and sits in a Suspense boundary. Below the md breakpoint the sidebar is hidden and MobileBar takes over.',
    returns: 'The <aside> as JSX.',
  },
  {
    symbol: 'frontend/src/components/app-shell/sidebar.tsx#MobileBar',
    status: 'verified',
    summary:
      'The top bar on small screens: the chat list menu, brand, search, new chat and the account.',
    why: 'It stands in for the sidebar below the md breakpoint: MobileNav opens the chat list, SearchIconButton opens search and the + link goes to / for a new chat. The account part comes in as children.',
    returns: 'The <header> as JSX.',
  },
  {
    symbol: 'frontend/src/components/app-shell/mobile-nav.tsx#MobileNav',
    status: 'verified',
    summary:
      'The chat list on small screens: a panel along the left edge, opened from the top bar.',
    how: [
      'The menu button opens it. It is a Radix dialog, so focus stays inside and Escape closes it.',
      'It holds New chat, Search chats and the same ChatList as the sidebar.',
      'A click on a link, or on an element marked data-closes-nav such as the search button, closes it.',
    ],
    why: 'Below the md breakpoint the sidebar is hidden, so the chats need another way in. Using the same ChatList means the same cached list.',
    returns: 'The menu button and the panel as JSX.',
  },
  {
    symbol: 'frontend/src/components/ui/dialog.tsx#Dialog',
    status: 'verified',
    summary: 'A modal dialog with a title, an optional description and a close button.',
    how: [
      'Radix keeps focus inside it and closes it on Escape; the title and description are wired to it for screen readers.',
      'On open it remembers what had focus, and on close gives focus back to it, even a plain button or a menu item.',
      'A field marked data-autofocus gets focus first, with its text selected, instead of the close button.',
    ],
    why: 'The rename dialog opens with the current title selected, and search starts in its field. Radix alone gives focus back only to its own Trigger, and these dialogs open from menus and shortcuts.',
    returns: 'The dialog as JSX.',
    tests: ['frontend/src/components/ui/overlays.test.tsx', FRONTEND_CHATS_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // frontend: chat data in the browser

  {
    symbol: 'frontend/src/store/api.ts#api',
    status: 'verified',
    summary:
      "The browser's data layer for chats: an RTK Query API whose calls all go to the app's own /api.",
    how: [
      'fetchBaseQuery uses the base URL /api, so every call goes to the Next.js proxy, which forwards it to the gateway with the session cookie.',
      'listChats is an infinite query for the sidebar: the first page is GET /api/chats, later pages add ?cursor=, and getNextPageParam reads nextCursor (null ends the list).',
      'searchChats is GET /api/chats?query=, getChat is GET /api/chats/:id and createChat is POST /api/chats.',
      'updateChat (PATCH, to rename or pin) and deleteChat (DELETE) change the cached list straight away in onQueryStarted, and undo that change if the call fails.',
      'The list queries provide the Chat LIST tag and getChat its own Chat tag. createChat, updateChat and deleteChat invalidate LIST, and updateChat also its chat, so those are fetched again once the call is done.',
    ],
    why: 'The sidebar, the small-screen panel and the recent chats in search use the same listChats cache, so one fetch serves them all. The optimistic changes make rename, pin and delete feel instant, and the undo keeps the list true when the server refuses. Nothing calls createChat yet.',
    returns:
      'The API object: its reducer, middleware, endpoints and hooks such as useListChatsInfiniteQuery and useUpdateChatMutation.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/store/api.ts#errorMessage',
    status: 'verified',
    summary: "A message for a failed call: the service's own detail when it sent problem+json.",
    how: [
      'An HTTP error whose body is an object gives its detail, or its title, and its requestId.',
      "A network failure (FETCH_ERROR) gives 'Could not reach GilderAi. Check your connection.'",
      "Anything else gives 'Something went wrong'.",
    ],
    why: 'ChatRow shows it in a toast when a rename, pin or delete fails, with the request ID as a reference for the logs.',
    returns: '{ message, requestId? }',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/store/store.tsx#makeStore',
    status: 'verified',
    summary: "Makes the Redux store: RTK Query's reducer and middleware.",
    how: [
      'The root reducer is written by hand (rootReducer): it runs api.reducer and keeps the same state object when nothing changed.',
      "Redux Toolkit's immutable and serializable checks, which run only in development, are turned on only in the browser.",
      'api.middleware comes after the default middleware; it runs the queries, the cache and the refetches.',
    ],
    why: "Handing configureStore an object of reducers would go through combineReducers, which calls Math.random(), and Next.js refuses random values while it prerenders the static shell. The development checks time each dispatch with Date.now(), which Next.js refuses there too. The server's store never holds data, because queries only run in the browser.",
    returns: 'A configured Redux store.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/store/store.tsx#StoreProvider',
    status: 'verified',
    summary: 'Gives the component tree one Redux store.',
    why: 'useState(makeStore) makes the store on the first render and keeps it, so each browser tab has its own and server renders never share one. Providers puts it around every page.',
    returns: 'The react-redux Provider as JSX.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/lib/chats.ts#groupChats',
    status: 'verified',
    summary: 'Splits the sidebar list into Pinned, Today, Previous 7 days and Older.',
    how: [
      'Pinned chats go to Pinned, however old they are.',
      'The others go by lastMessageAt: Today from local midnight, Previous 7 days for the week before that, Older before that.',
      'Chats keep the order the service sent. A chat that comes twice is shown once, and empty groups are left out.',
    ],
    why: "The service sends one ordered list; the groups are only for display and depend on the user's clock and time zone, so they are made in the browser. ChatList calls it only once chats have loaded, never in the prerendered shell, where Next.js refuses the current time.",
    returns: 'An array of { label, chats }.',
    tests: [FRONTEND_CHATS_LIB_TEST, FRONTEND_CHATS_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // frontend: the chat list, search and chat page

  {
    symbol: 'frontend/src/components/chats/chat-list.tsx#ChatList',
    status: 'verified',
    summary: 'The chats in the sidebar, grouped, with Show more for older pages.',
    how: [
      'useListChatsInfiniteQuery loads the first page in the browser.',
      "While it loads there are skeleton lines; on failure 'Could not load your chats.' with Try again; with no chats 'No chats yet. Start one with New chat.'",
      'Otherwise each group from groupChats is a section with a heading and one ChatRow per chat.',
      'Show more fetches the next page while there is one.',
    ],
    why: 'The same component is in the sidebar and in the small-screen panel (MobileNav), so both show one cached list.',
    returns: 'The list as JSX.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/components/chats/chat-row.tsx#ChatRow',
    status: 'verified',
    summary: 'One chat in the sidebar: a link to /c/<id>, and a menu to rename, pin or delete it.',
    how: [
      "The link has aria-current='page' when its chat is open.",
      'Rename opens a dialog with the title selected. Save sends updateChat with the trimmed title; an empty or unchanged title just closes it.',
      "Pin or Unpin sends updateChat with pinned flipped, then puts keyboard focus on the row's menu button in its new group.",
      "Delete asks first ('Delete chat?'). After the delete it goes to / if the deleted chat was open.",
      "A failed call shows a toast, such as 'Could not rename the chat', with the service's message and request ID (errorMessage).",
      'A dialog picked from the menu opens only after the menu has closed and given focus back to its button, so the dialog can return focus there.',
    ],
    why: 'Rename, pin and delete live where the chat is listed, and the list changes at once: updateChat and deleteChat change the cache and undo it on failure.',
    returns: 'The row as JSX.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/components/chats/search-dialog.tsx#SearchDialog',
    status: 'verified',
    summary: 'Search chats by title or message text (⌘K).',
    how: [
      'What is typed is used after a 250 ms pause. From 2 characters on, it runs searchChats and shows the results.',
      'With less typed it shows the 8 latest chats from the listChats cache, under Recent.',
      'Arrow keys move the active result while the field keeps focus (aria-activedescendant), and Enter opens it; a click opens one too.',
      "Status lines say 'Searching…', 'Search failed. Try again.', 'No chats match …' or 'No chats yet.'",
      'Closing it clears the text.',
    ],
    why: 'It is a combobox with a listbox, so screen readers announce the active result while typing goes on. Its queries run only while it is open.',
    returns: 'The dialog as JSX.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/components/chats/chat-commands.tsx#ChatCommands',
    status: 'verified',
    summary: 'The app-wide chat shortcuts, and the one search dialog.',
    how: [
      '⌘K (Ctrl+K) opens or closes search.',
      '⌘⇧O (Ctrl+Shift+O) closes search and goes to / for a new chat.',
      'With Alt held, neither fires.',
      'It hands the function that opens search to SearchButton and SearchIconButton through a context.',
    ],
    why: 'The (app) layout wraps every signed-in page in it, so the shortcuts work everywhere and every search button opens the same dialog.',
    returns: 'Its children, plus the search dialog.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/components/chats/chat-commands.tsx#SearchButton',
    status: 'verified',
    summary: "The sidebar's Search chats button, with its ⌘K hint.",
    why: 'It opens the dialog ChatCommands owns. data-closes-nav makes the small-screen panel close when it is used.',
    returns: 'A button as JSX.',
  },
  {
    symbol: 'frontend/src/components/chats/chat-commands.tsx#SearchIconButton',
    status: 'verified',
    summary: 'The search icon in the small-screen top bar.',
    why: 'It opens the same search dialog as SearchButton and the ⌘K shortcut.',
    returns: 'An icon button as JSX.',
  },
  {
    symbol: 'frontend/src/components/chats/chat-header.tsx#ChatHeader',
    status: 'verified',
    summary: "The chat page's title bar, with a pin icon when the chat is pinned.",
    how: [
      'It starts from the chat the server rendered, then follows getChat, which it also fetches in the browser.',
      "It sets the tab title to '<title> · GilderAi' whenever the title changes.",
    ],
    why: 'A rename or pin from the sidebar marks this chat stale in the cache, so the header and the tab title follow without a reload. generateMetadata sets the first title; this keeps it current.',
    returns: 'The header as JSX.',
  },
  {
    symbol: 'frontend/src/components/chats/message-list.tsx#MessageList',
    status: 'verified',
    summary:
      "The conversation, oldest first: the user's messages on the right, answers on the left.",
    how: [
      "Each message is a list item, with 'You:' or 'GilderAi:' for screen readers. Line breaks are kept.",
      "A stopped answer shows 'Stopped' and a failed one 'This answer failed.'",
      "With no messages it shows 'No messages yet' and 'Ask anything to start this chat.'",
    ],
    why: 'It uses no browser-only code, so the chat page renders the history on the server and it shows on first paint.',
    returns: 'The list as JSX.',
    tests: [FRONTEND_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/server/gateway-fetch.ts#gatewayGet',
    status: 'verified',
    summary: "A GET to the gateway from a server component, with the browser's cookies.",
    how: [
      'With no gilder_sid cookie it returns null and calls nothing.',
      "Otherwise it fetches GATEWAY_URL plus the path, with the browser's cookies, x-gilder-client: web and cache: 'no-store'.",
    ],
    why: 'Server components skip the /api proxy and call the gateway directly. Reading cookies makes the caller per-request, so callers sit inside a Suspense boundary. It sends no Origin, which a GET does not need, and no request ID, so the gateway makes one. getCurrentUser and getChatWithHistory use it.',
    returns: 'A promise of the Response, or null.',
    tests: [FRONTEND_SESSION_TEST, FRONTEND_SERVER_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/server/gateway-fetch.ts#SESSION_COOKIE',
    status: 'verified',
    summary: "The session cookie's name for the server-side gateway calls: gilder_sid.",
    why: "gatewayGet checks for it before calling the gateway. The login gate (proxy.ts) keeps its own copy of the name, and the backend's is SESSION_COOKIE in @gilder/shared.",
    returns: "'gilder_sid'",
  },
  {
    symbol: 'frontend/src/server/chats.ts#getChatWithHistory',
    status: 'verified',
    summary: 'A chat and its latest page of messages, for the server render of /c/[chatId].',
    how: [
      'An ID that is not 24 lowercase hex characters gives null without calling the gateway.',
      'Otherwise GET /api/chats/<id> and GET /api/chats/<id>/messages run at the same time through gatewayGet.',
      'No session cookie, or a 401 for the chat, redirects to /login.',
      "A 404 for the chat gives null: missing, deleted and someone else's chats look the same.",
      'Any other failure throws.',
    ],
    why: "React's cache() runs it once per request, so generateMetadata and the page share one pair of calls.",
    returns: 'A promise of { chat, messages }, or null.',
    tests: [FRONTEND_SERVER_CHATS_TEST],
  },
  {
    symbol: 'frontend/src/app/(app)/c/[chatId]/page.tsx#ChatPage',
    status: 'verified',
    summary: 'One chat at /c/<id>, with its history rendered on the server.',
    why: 'It shows a skeleton in a Suspense boundary while ChatView loads the chat with getChatWithHistory. ChatView then renders ChatHeader and MessageList, or calls notFound() when the chat is not available.',
    returns: 'The page as JSX.',
  },
  {
    symbol: 'frontend/src/app/(app)/c/[chatId]/page.tsx#generateMetadata',
    status: 'verified',
    summary: "Titles the tab with the chat's title, or 'Chat not found'.",
    why: "It calls getChatWithHistory, which is cached for the request, so it costs no extra calls. The root layout's title template adds ' · GilderAi'.",
    returns: 'A promise of { title }.',
  },
  {
    symbol: 'frontend/src/app/(app)/c/[chatId]/not-found.tsx#ChatNotFound',
    status: 'verified',
    summary: "The page for a chat that isn't available.",
    why: 'A chat that does not exist, was deleted or belongs to someone else all lead here, with the same words, so the page cannot tell which. It links to / to start a new chat.',
    returns: 'The page as JSX.',
  },
];

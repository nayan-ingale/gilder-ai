import type { SymbolNote } from './schema.ts';

/**
 * Notes on each function, class, method and constant: what it is for, in words. Signatures,
 * lines and callers come from the generated index, so they are not repeated here.
 */

const CONSTANTS_TEST = 'backend/shared/src/constants.test.ts';
const ENV_TEST = 'backend/shared/src/env.test.ts';
const INTERNAL_TOKEN_TEST = 'backend/shared/src/internalToken.test.ts';
const INTERNAL_CLIENT_TEST = 'backend/shared/src/internalClient.test.ts';
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
 * The real auth, chat and billing apps on their own ports behind the real gateway: sign-in with
 * the sign-up grant, profile, logout, chats, the balance, SEC-01/02/04/06.
 */
const JOURNEY_TEST = 'backend/gateway/src/journey.test.ts';
const AUTH_TEST = 'backend/services/auth/src/app.test.ts';
const AUTH_ENV_SCHEMA_TEST = 'backend/services/auth/src/env-schema.test.ts';
const AUTH_USERS_TEST = 'backend/services/auth/src/users.test.ts';
const AUTH_FIREBASE_TEST = 'backend/services/auth/src/firebase.test.ts';
const AUTH_SESSION_ROUTES_TEST = 'backend/services/auth/src/session-routes.test.ts';
const AUTH_ME_ROUTES_TEST = 'backend/services/auth/src/me-routes.test.ts';
const AUTH_BILLING_TEST = 'backend/services/auth/src/billing.test.ts';
const CHAT_TEST = 'backend/services/chat/src/app.test.ts';
const CHAT_MODELS_TEST = 'backend/services/chat/src/models.test.ts';
const CHAT_ROUTES_TEST = 'backend/services/chat/src/chat-routes.test.ts';
const CHAT_INTERNAL_ROUTES_TEST = 'backend/services/chat/src/internal-routes.test.ts';
const AGENT_TEST = 'backend/services/agent/src/app.test.ts';
const AGENT_ENV_SCHEMA_TEST = 'backend/services/agent/src/env-schema.test.ts';
const AGENT_LLM_TEST = 'backend/services/agent/src/llm/llm.test.ts';
const AGENT_MOCK_TEST = 'backend/services/agent/src/llm/mock.test.ts';
const AGENT_OPENAI_TEST = 'backend/services/agent/src/llm/openai-compatible.test.ts';
const AGENT_SSE_TEST = 'backend/services/agent/src/llm/sse.test.ts';
const AGENT_STRUCTURED_TEST = 'backend/services/agent/src/structured.test.ts';
const AGENT_ROUTING_TEST = 'backend/services/agent/src/routing.test.ts';
const AGENT_CHAT_TEST = 'backend/services/agent/src/agents/chat.test.ts';
const AGENT_MEMORY_TEST = 'backend/services/agent/src/memory.test.ts';
const AGENT_SERVICES_TEST = 'backend/services/agent/src/services.test.ts';
/** The turn route with the real chat and billing apps, a test Redis and a scripted mock model. */
const AGENT_TURNS_TEST = 'backend/services/agent/src/turns.test.ts';
const BILLING_TEST = 'backend/services/billing/src/app.test.ts';
const BILLING_MODELS_TEST = 'backend/services/billing/src/models.test.ts';
/** The sign-up grant, POST /internal/accounts and GET /account. */
const BILLING_CREDITS_TEST = 'backend/services/billing/src/credits.test.ts';
/** Reserve, commit and release, the ledger invariant, SEC-08 and the credit routes. */
const BILLING_RESERVATIONS_TEST = 'backend/services/billing/src/reservations.test.ts';
const BILLING_SWEEPER_TEST = 'backend/services/billing/src/sweeper.test.ts';

/** Each app's test sends /healthz, /readyz and an unknown route through the shared middleware. */
const APP_TESTS = [GATEWAY_TEST, AUTH_TEST, CHAT_TEST, AGENT_TEST, BILLING_TEST];

const FRONTEND_CHATS_TEST = 'frontend/src/components/chats/chats.test.tsx';
const FRONTEND_CHATS_LIB_TEST = 'frontend/src/lib/chats.test.ts';
const FRONTEND_SERVER_CHATS_TEST = 'frontend/src/server/chats.test.ts';
const FRONTEND_SESSION_TEST = 'frontend/src/server/session.test.ts';
const FRONTEND_CREDITS_TEST = 'frontend/src/components/billing/credits-card.test.tsx';
const BILLING_PAYMENTS_TEST = 'backend/services/billing/src/payments.test.ts';
const AGENT_FILE_ROUTES_TEST = 'backend/services/agent/src/files/file-routes.test.ts';
const AGENT_FILE_CHECKS_TEST = 'backend/services/agent/src/files/file-checks.test.ts';
const AGENT_CHUNKS_TEST = 'backend/services/agent/src/rag/chunks.test.ts';
const AGENT_INDEXER_TEST = 'backend/services/agent/src/rag/indexer.test.ts';
const AGENT_CLEANUP_TEST = 'backend/services/agent/src/rag/cleanup.test.ts';
const FRONTEND_BILLING_TEST = 'frontend/src/components/billing/billing.test.tsx';
const FRONTEND_DAILY_CHART_TEST = 'frontend/src/components/billing/daily-chart.test.ts';
const AGENT_QA_TEST = 'backend/services/agent/src/agents/qa.test.ts';
const AGENT_GENERATE_TEST = 'backend/services/agent/src/agents/generate.test.ts';
const AGENT_RENDER_TEST = 'backend/services/agent/src/generate/render.test.ts';
const FRONTEND_UPLOADS_TEST = 'frontend/src/lib/uploads.test.ts';
const FRONTEND_CHAT_THREAD_TEST = 'frontend/src/components/chat/chat-thread.test.tsx';

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
    status: 'verified',
    summary: 'How many credits one answer from each agent costs.',
    why: "Prices live in one place, next to the agent list. It is typed as a record over every agent, so adding an agent without a price fails the typecheck. Its comment notes that choosing the agent (the router call) is free. Billing's reserveCredits takes the amount from it, so a caller names the agent, never the price; the agent's turn route refuses a user with less than the chat price before any AI call.",
    returns: 'chat costs 1 credit, search 5, and every other agent 10.',
    tests: [CONSTANTS_TEST, BILLING_RESERVATIONS_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/shared/src/constants.ts#AGENT_RATE_LIMITS',
    status: 'verified',
    summary: 'How many requests per minute each user may send to each agent.',
    why: "Each agent gets its own limit, so the costlier agents can be held tighter than plain chat. Like CREDIT_COSTS, every agent must have an entry or the typecheck fails. The agent's runTurn applies the routed agent's limit after routing and before any credits are held.",
    returns: 'chat allows 20 requests a minute; every other agent allows 5.',
    tests: [CONSTANTS_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/shared/src/constants.ts#SIGNUP_CREDITS',
    status: 'verified',
    summary: 'The credits every new account starts with.',
    why: "Named once so the sign-up grant and the Free plan cannot drift apart: PLANS.free uses it for its credits. Billing's grantSignupCredits adds exactly this many, with a signup_grant ledger entry, and journey.test.ts checks the balance after a first sign-in.",
    returns: 'The number 100.',
    tests: [CONSTANTS_TEST, BILLING_CREDITS_TEST, JOURNEY_TEST],
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
    status: 'verified',
    summary: 'The three plans a user can have: Free, Starter and Pro.',
    how: [
      'Prices are in paise (₹1 = 100 paise), the unit Razorpay works in.',
      '`satisfies Record<string, Plan>` checks that each plan has every field of Plan.',
      '`as const` keeps the exact values, so code can rely on them as types.',
    ],
    why: "Whole numbers of paise avoid rounding errors with money. Per its comment, `validityDays` is how long a plan badge lasts; purchased credits never expire. Billing takes its plan names from it (PLAN_IDS), so an account's plan can only be one of these. Billing prices every order from it and grants the plan's credits and validity days once a payment is checked (paymentRouter, grantPurchase).",
    returns:
      'Free: 0 paise and 100 credits. Starter: 19,900 paise (₹199) and 500 credits. Pro: 49,900 paise (₹499) and 1,000 credits. Each lasts 30 days.',
    tests: [CONSTANTS_TEST, BILLING_MODELS_TEST],
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
    why: 'Every app needs these two, so they are defined once. Each app extends this schema with its own variables: in its src/env.ts, or for the gateway, auth and the agent in src/env-schema.ts.',
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
    why: "Auth, chat, agent and billing all check internal tokens, so they share one rule for the keys that check them: the gateway's INTERNAL_PUBLIC_KEY everywhere, and AUTH_PUBLIC_KEY and AGENT_PUBLIC_KEY where those services may call. Neither message repeats the value. It looks only at the PEM header: whether the rest is a usable key shows when index.ts imports it with importInternalPublicKey.",
    returns: 'A Zod schema whose parsed value is the PEM text, with real line breaks.',
    tests: [AUTH_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#isEd25519PrivateKey',
    status: 'verified',
    summary: 'Says whether a text parses as an Ed25519 private key.',
    why: "It asks Node's createPrivateKey to read the text and checks the key type, the kind `pnpm setup:keys` writes. Anything that fails to parse is simply false, so the settings check reports one clear message instead of a crypto error.",
    returns: 'true or false.',
    tests: [GATEWAY_ENV_SCHEMA_TEST, AUTH_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#internalPrivateKeySchema',
    status: 'verified',
    summary: 'The Zod schema for a private key that signs internal tokens.',
    how: [
      "A missing value fails with 'is missing: run pnpm setup:keys'.",
      'Escaped `\\n` line breaks are turned back into real ones.',
      "The result must parse as an Ed25519 private key (isEd25519PrivateKey), or it fails with 'is not a valid Ed25519 private key: run pnpm setup:keys'.",
    ],
    why: 'Three apps sign tokens: the gateway with INTERNAL_PRIVATE_KEY, and auth and the agent with their own SERVICE_PRIVATE_KEY. The key is parsed, not just matched on its header, so a corrupt key stops the app at startup. Neither message repeats the value.',
    returns: 'A Zod schema whose parsed value is the PEM text, with real line breaks.',
    tests: [GATEWAY_ENV_SCHEMA_TEST, AUTH_ENV_SCHEMA_TEST, AGENT_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/shared/src/env.ts#serviceUrlSchema',
    status: 'verified',
    summary:
      "The Zod schema for another service's base URL: an http(s) URL, without trailing slashes.",
    why: "Callers build each URL as the base followed by a path, so a trailing slash would double the slash. Any other protocol fails with 'must be an http(s) URL'. The gateway uses it for its four service URLs, auth for BILLING_SERVICE_URL, and the agent for CHAT_SERVICE_URL and BILLING_SERVICE_URL, each with a localhost default.",
    returns: 'A Zod schema whose parsed value is the URL text without trailing slashes.',
    tests: [GATEWAY_ENV_SCHEMA_TEST, AUTH_ENV_SCHEMA_TEST],
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
    why: "/healthz says the process is up; it is meant to be used to restart a stuck app. /readyz says its dependencies answer; it is meant to decide whether to send the app traffic. Outside the tests, the end-to-end CI job reads /healthz, to wait until each app is up, and the web app's GET /api/health reads the gateway's /readyz for uptime monitors; neither Docker Compose file has health checks for the apps, only for the data stores. Failure reasons go to the logs only, so internal addresses are not exposed.",
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
    why: "The signers and the services must agree on the header name, so it is defined once. The logger separately redacts this header, so tokens never reach the logs. The gateway's proxyToService sets it on every request it forwards, createInternalClient on every call one service makes to another, and requireInternalToken reads it in auth, chat, agent and billing.",
    returns: "The string 'x-internal-token'.",
    tests: [INTERNAL_TOKEN_TEST, INTERNAL_CLIENT_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#INTERNAL_CALLERS',
    status: 'verified',
    summary: 'Who can sign internal tokens: the gateway, auth and the agent.',
    why: 'The gateway signs for every request it forwards. Auth and the agent also call other services, each with its own key: auth asks billing for the sign-up grant, and the agent reads and saves chats and holds and charges credits. A service trusts exactly the callers it needs, and a route can name the callers allowed to use it (requireCaller). The types InternalCaller and ServiceCaller (every caller but the gateway) come from this list.',
    returns: "A read-only array: 'gateway', 'auth', 'agent'.",
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#issuerOf',
    status: 'verified',
    summary: "The issuer a caller writes into its tokens: 'gilder-' and its name.",
    why: 'signInternalToken writes it into every token, and verifyInternalToken reads it back to choose which public key to check the signature with. jose then checks the issuer again against that caller, so a token that claims one signer but is signed by another fails.',
    returns: "A string such as 'gilder-gateway' or 'gilder-agent'.",
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
    why: "Keys are kept as PEM text, for example in .env files, but jose signs with a key object. It always imports the key for EdDSA. The gateway's index.ts imports INTERNAL_PRIVATE_KEY with it, and auth's and the agent's index.ts import their own SERVICE_PRIVATE_KEY, which createInternalClient signs their calls with. The settings checks (internalPrivateKeySchema) have already made sure each text parses as an Ed25519 private key.",
    returns: 'A promise of the key object (InternalKey).',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#importInternalPublicKey',
    status: 'verified',
    summary: 'Turns a public key in PEM text into a key object that can verify internal tokens.',
    why: "Services only need public keys: one can check a token but cannot make one. It always imports the key for EdDSA. Auth, chat, agent and billing each import the gateway's INTERNAL_PUBLIC_KEY with it at startup; billing also imports AUTH_PUBLIC_KEY and AGENT_PUBLIC_KEY, and chat AGENT_PUBLIC_KEY, for the services allowed to call them. The settings checks only look at the PEM header, so a key that has the header but cannot be read makes it reject; nothing catches that, so the service exits with code 1 before it listens.",
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
    why: 'Its comment says it is for .env files and tests. The private key signs tokens and the public key checks them. The `pnpm setup:keys` script (backend/shared/scripts/setup-keys.ts) calls it for each signer that has no key yet, or for all of them with --rotate: the gateway, auth and the agent. The tests make a pair for each signer they need.',
    returns: 'A promise of { privateKey, publicKey }, both PEM strings.',
    tests: [INTERNAL_TOKEN_TEST],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#signInternalToken',
    status: 'verified',
    summary:
      'Signs a short-lived token for one service, naming who signed it and, when there is one, the user.',
    how: [
      'The subject (`sub`) is the user ID, set only when a user ID is given. A token for a request with no session, such as a sign-in, has no `sub`.',
      'The request ID, when given, goes in a `rid` claim.',
      "The issuer names the caller (issuerOf): 'gilder-gateway' unless a service signs, and the audience is the service the token is for.",
      'It expires after `ttlSeconds` (60 by default) and is signed with EdDSA.',
    ],
    why: "Services never trust a plain user-ID header, because anything that can reach a service could claim to be any user. So services accept only a signed token addressed to them. A token without a user still proves the request came through a trusted signer, so no service route has to be open to direct calls. The audience stops a token for one service being used against another, and the short life limits the harm if one leaks. The gateway's proxyToService signs one for every request it forwards, and createInternalClient for every call auth or the agent makes, with the caller's own key.",
    returns: 'A promise of the signed token, a JWT string.',
    tests: [
      INTERNAL_TOKEN_TEST,
      INTERNAL_CLIENT_TEST,
      GATEWAY_PROXY_TEST,
      GATEWAY_TEST,
      JOURNEY_TEST,
    ],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#verifyInternalToken',
    status: 'verified',
    summary:
      'Checks an internal token against the keys this service trusts, and reads the signer, the user and the request ID.',
    how: [
      "It reads the token's issuer without checking anything, only to pick the key: an issuer that is no known caller, or a caller with no key in `trusted`, is refused straight away.",
      "jose then checks the signature with that caller's key, the issuer, the audience and the expiry, and accepts only EdDSA.",
      '`currentDate` lets tests pretend time has passed.',
      'It returns the caller always, `userId` only when `sub` is a non-empty string, and `requestId` only when the `rid` claim is a string.',
    ],
    why: "A service must reject a token that is missing, forged, expired, addressed to another service or signed by a caller it does not trust. Each signer has its own key, so a service's key cannot pass for the gateway's, nor the other way round. Whether a route needs a user or a particular caller is checked separately (requireUser, requireCaller). Only requireInternalToken calls it.",
    returns: 'A promise of { caller, userId?, requestId? }. It rejects when any check fails.',
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
      'It stores the signer in `res.locals.caller`, and, when the token names a user, the user ID in `res.locals.userId` and in the request context.',
      'A valid token with no user passes too, with no user set. It does not require one: routes that act for a user add requireUser() after it.',
      'Express 5 passes errors thrown in async middleware to the error handler, which answers 401.',
    ],
    why: "It is how a service knows that a request came from a signer it trusts, which one, and which user it is for. A direct call without a valid token gets 401. With the `internalAuth` option, createService puts it in front of every route except /healthz and /readyz, with the gateway's key and the keys in `callers`. Auth, chat, agent and billing pass that option, each with its own name as the audience; chat also trusts the agent, and billing auth and the agent.",
    returns: 'An async Express middleware function.',
    sideEffects: [
      'Sets res.locals.caller, and res.locals.userId when the token names a user.',
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
    why: "A valid internal token only proves that a request came from a trusted signer; requests with no session, such as a sign-in, carry one too. Routes that must know the user add this check on top: in auth, DELETE /sessions/current, GET and PATCH /me and GET /internal/users/:id; in chat, every /chats and /internal route; in billing, GET /account and every /internal route; and the agent's turn route.",
    returns: 'An Express middleware function.',
    tests: [
      INTERNAL_TOKEN_TEST,
      CHAT_ROUTES_TEST,
      CHAT_INTERNAL_ROUTES_TEST,
      BILLING_CREDITS_TEST,
      AGENT_TURNS_TEST,
    ],
  },
  {
    symbol: 'backend/shared/src/internalToken.ts#requireCaller',
    status: 'verified',
    summary:
      'Middleware for internal routes meant for one service: answers 403 unless the token was signed by one of the named callers.',
    how: [
      'It runs after requireInternalToken, which sets `res.locals.caller`.',
      "A caller not in the list, the gateway included, gets AppError('forbidden', 'This route is not open to this caller'): 403.",
    ],
    why: "The gateway never forwards /internal routes, but a service that trusts two callers would otherwise let either one use every route. Chat's /internal routes take only the agent; billing's POST /internal/accounts takes only auth, and its credit routes only the agent. So auth's key cannot reserve credits, and the agent's cannot grant them.",
    returns: 'An Express middleware function.',
    tests: [
      INTERNAL_TOKEN_TEST,
      CHAT_INTERNAL_ROUTES_TEST,
      BILLING_CREDITS_TEST,
      BILLING_RESERVATIONS_TEST,
    ],
  },

  // -------------------------------------------------------------------------------------------
  // backend/shared/src/internalClient.ts

  {
    symbol: 'backend/shared/src/internalClient.ts#createInternalClient',
    status: 'verified',
    summary:
      'How one service calls another: a fresh token signed with its own key, for the same user and request, with a time limit.',
    how: [
      "Each call signs a new 60-second token: audience the service called, issuer the caller, subject the user the call is for, and the current request's ID from the request context as `rid`.",
      'It sends the token in x-internal-token, the request ID in X-Request-Id and a JSON body when there is one, and gives up after 5 seconds (DEFAULT_TIMEOUT_MS) unless told otherwise.',
      'A 204 gives undefined and a 2xx its JSON body.',
      'A 4xx whose body names a known error code is thrown again as that AppError, with its detail: a 402 from billing stays a 402.',
      "A 5xx, a timeout or a refused connection becomes AppError('service_unavailable').",
      'With `retry: true`, a service_unavailable is tried once more after 200 ms (RETRY_DELAY_MS); only for calls that are safe to repeat.',
    ],
    why: "Auth's sign-up grant and every call the agent makes to chat and billing go through it, so they all sign, time out and report errors the same way. A fresh token per call means a long answer never outlives its token, and the shared request ID ties the services' log lines together.",
    returns: 'A client with one method, request(method, path, { userId, body, retry }).',
    tests: [INTERNAL_CLIENT_TEST, AUTH_BILLING_TEST, AGENT_SERVICES_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/shared/src/internalClient.ts#DEFAULT_TIMEOUT_MS',
    status: 'verified',
    summary: 'How long a call to another service may take by default: 5 seconds.',
    why: 'A service that does not answer must not hold up the caller: a sign-in waiting for billing, or an answer waiting for chat. A caller can pass its own timeoutMs; none does today.',
    returns: 'The number 5000.',
    tests: [INTERNAL_CLIENT_TEST],
  },
  {
    symbol: 'backend/shared/src/internalClient.ts#RETRY_DELAY_MS',
    status: 'verified',
    summary: 'The pause before the one retry: 200 milliseconds.',
    why: 'A short wait gives a restarting service a moment without making the user wait long.',
    returns: 'The number 200.',
    tests: [INTERNAL_CLIENT_TEST],
  },
  {
    symbol: 'backend/shared/src/internalClient.ts#isErrorCode',
    status: 'verified',
    summary: 'Says whether a value is one of the shared error codes.',
    why: "createInternalClient keeps the other service's error code only when it is one the shared errors know, so an unknown body never turns into a strange error.",
    returns: 'true or false.',
    tests: [INTERNAL_CLIENT_TEST],
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
    why: "Counting in Redis means every copy of an app shares the same counts. The count and its expiry are set in one transaction, so a counter is never left behind without an expiry. EXPIRE with NX needs Redis 7 or later; backend/docker-compose.yml and CI run redis:7-alpine. rateLimit calls it for the gateway's per-IP and per-user limits (keys rl:ip:<address> and rl:user:<user ID>), and the agent's runTurn calls it directly for each agent's per-minute limit (rl:agent-<agent>:<user ID>).",
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
      'When `parseJson` is true (the default), express.json() parses JSON bodies up to `bodyLimit` (64kb by default), and its verify hook keeps the exact bytes on the request for rawBodyOf. When it is false, bodies are left unread, byte for byte.',
      'healthRouter() adds /healthz and /readyz.',
      "When the `internalAuth` option is given, requireInternalToken() comes next, trusting the gateway's key and the keys in `internalAuth.callers`. Every route except /healthz and /readyz then needs a valid internal token addressed to this service, so a direct call gets 401 on any path, even an unknown one, unless its JSON body is rejected first: the body parser runs before the token check.",
      "The app's own `routes` come next.",
      'notFoundHandler() and errorHandler() come last, to catch whatever is left.',
    ],
    why: 'Middleware order matters: the request ID must exist before anything logs, health probes must not need a token, and the error handler must come last. The token check runs before the routes, so a call without a token cannot learn from a 404 which paths exist. Writing the order once means all five apps get it right. The gateway turns `parseJson` off, so it forwards bodies to the services untouched, and passes its /api router as its routes. Auth, chat, agent and billing pass `internalAuth` and their own routes; chat lists the agent in `callers`, and billing auth and the agent.',
    returns: 'The Express app, not listening yet.',
    sideEffects: [
      'For each request once the app listens: sets security headers and X-Request-Id, and writes a request log line (not for GET or HEAD health probes).',
    ],
    tests: [SERVICE_TEST, ...APP_TESTS],
  },
  {
    symbol: 'backend/shared/src/service.ts#rawBodyOf',
    status: 'verified',
    summary: 'The JSON body exactly as it arrived, before parsing.',
    how: [
      "createService's JSON parser has a verify hook that keeps the bytes it read on the request (the rawBody of RawBodyRequest).",
      'rawBodyOf returns them, or undefined when the request had no JSON body.',
    ],
    why: "A webhook signature is computed over the exact bytes that were sent, and JSON parsed and written out again can differ in spacing or key order. Billing checks Razorpay's webhook signature over these bytes (paymentRouter).",
    returns: 'A Buffer, or undefined.',
    tests: [BILLING_PAYMENTS_TEST],
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
      'mongodb-memory-server downloads a mongod binary on first use and starts it, so no Docker is needed: a single server by default, or a one-member replica set (WiredTiger) with `{ replicaSet: true }`.',
      'connectMongo connects the shared Mongoose to its gilder_test database, with a silent logger.',
      '`stop()` disconnects Mongoose and stops the server.',
    ],
    why: "For tests only: an app's tests import it from `@gilder/shared/testing`, a separate entry that the running apps never load. Each call starts its own server, so test files running at the same time never share data. Transactions need a replica set, so billing's tests, the agent's turn and service tests and the gateway's journey.test.ts ask for one; auth's and chat's model and route tests use a single server.",
    returns: 'A promise of { stop }.',
    sideEffects: [
      'Starts a mongod process (or a one-member replica set) and connects Mongoose to it.',
    ],
    tests: [
      AUTH_USERS_TEST,
      AUTH_SESSION_ROUTES_TEST,
      AUTH_ME_ROUTES_TEST,
      CHAT_MODELS_TEST,
      CHAT_ROUTES_TEST,
      CHAT_INTERNAL_ROUTES_TEST,
      BILLING_MODELS_TEST,
      BILLING_RESERVATIONS_TEST,
      AGENT_TURNS_TEST,
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
      'At startup, index.ts passes one readiness check (redis), the Redis client, the imported INTERNAL_PRIVATE_KEY, the four service URLs, FRONTEND_ORIGIN as allowedOrigins, TRUST_PROXY_HOPS, and the two rate limits as rateLimits, which go to ipRateLimit and userRateLimit.',
    ],
    why: "Every check every request needs lives in one place, cheapest first, and the route table decides what may reach a service at all, so a service's internal routes cannot be called from outside. Building the app apart from starting it lets tests pass a test Redis, a key pair made for the test and a stand-in service, or the real auth, chat and billing apps (journey.test.ts). The optional `headersTimeoutMs` can shorten the proxy's 10-second wait for a service; index.ts does not set it.",
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
      'AUTH_SERVICE_URL, CHAT_SERVICE_URL, AGENT_SERVICE_URL and BILLING_SERVICE_URL must be http(s) URLs (the shared serviceUrlSchema); trailing slashes are stripped.',
      'INTERNAL_PRIVATE_KEY, which signs the internal tokens, is required and must parse as an Ed25519 private key (the shared internalPrivateKeySchema). Its messages say to run `pnpm setup:keys` and never repeat the value.',
      "TRUST_PROXY_HOPS is a whole number from 0 to 5 (default 1): how many proxies in front of the gateway to trust for the client's IP address.",
      'RATE_LIMIT_PER_IP and RATE_LIMIT_PER_USER are whole numbers from 1 to 100,000, by default the shared GATEWAY_RATE_LIMITS (120 and 60): requests a minute from one IP address and from one signed-in user.',
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
      "POST /api/chats/:id/messages goes to the agent's POST /chats/:id/turns (send a message); POST /api/chats/:id/messages/:messageId/regenerate and /edit go to the agent's routes of the same path; POST /api/turns/:turnId/stop goes to the agent's /turns/:turnId/stop. Each streams its answer back, and each requires a session.",
      "GET /api/billing/account goes to billing's GET /account (the plan and balance); a session is required.",
      "POST /api/files/uploads, POST /api/files/:fileId/complete, GET /api/files/:fileId and GET /api/files/:fileId/url go to the agent's /files routes of the same shape (start and complete an upload, a file's details, a download link); each requires a session.",
      "GET /api/billing/plans, POST /api/billing/orders, POST /api/billing/orders/:orderId/verify and GET /api/billing/payments go to billing's /plans, /orders, /orders/:orderId/verify and /payments, and GET /api/usage/summary and /api/usage/events to its /usage/summary and /usage/events. Each requires a session.",
      "POST /api/webhooks/razorpay goes to billing's POST /webhooks/razorpay with no session. It is marked webhook with the headers x-razorpay-signature and x-razorpay-event-id: the Origin check skips it, and the two headers are passed on.",
    ],
    why: "It is an allowlist: anything not listed gets the gateway's own 404 and never reaches a service, so auth's GET /internal/users/:id and the /internal routes of chat and billing cannot be called from outside (journey.test.ts checks them, SEC-01).",
    returns: 'A read-only array of twenty-three PublicRoute entries.',
    tests: [GATEWAY_ROUTE_TABLE_TEST, GATEWAY_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/gateway/src/route-table.ts#PublicRoute',
    status: 'verified',
    summary:
      'One entry of the route table: a public method and path, the service and target path it goes to, and its session rule.',
    how: [
      "session is 'required' (the caller must be signed in) or 'none' (open, such as sign-in itself).",
      "webhook, when set, marks a server-to-server route such as Razorpay's: originCheck lets it through without an Origin, and proxyToService passes its listed headers on, for that route only.",
    ],
    why: 'Each exception to the usual checks is written on its own route, where it is easy to see and review, instead of being hidden in the guards.',
    tests: [GATEWAY_ROUTE_TABLE_TEST, GATEWAY_TEST],
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
      "GET, HEAD and OPTIONS pass straight through, and so does a route marked webhook (PublicRoute.webhook), which comes from another server; its service checks the sender's signature instead.",
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
    summary:
      'At most 120 requests a minute from one IP address, signed in or not, unless RATE_LIMIT_PER_IP says otherwise.',
    why: "It is rateLimit with the scope 'ip', the given limit (GATEWAY_RATE_LIMITS.perIp by default) and `req.ip` as the key, which `trust proxy` reads from X-Forwarded-For. It runs first in the /api router, so it counts every request that reaches it, including unknown paths, and a client over the limit gets 429 with Retry-After before anything else is done.",
    returns: 'An async Express middleware function.',
    sideEffects: ['Counts the request in Redis under rl:ip:<address>.'],
    tests: [GATEWAY_GUARDS_TEST],
  },
  {
    symbol: 'backend/gateway/src/guards.ts#userRateLimit',
    status: 'verified',
    summary:
      'At most 60 requests a minute from one signed-in user, from any number of devices, unless RATE_LIMIT_PER_USER says otherwise.',
    why: "It is rateLimit with the scope 'user', the given limit (GATEWAY_RATE_LIMITS.perUser by default) and `res.locals.userId` as the key. It runs after sessionLookup, so a request with no session is not counted here and only the per-IP limit applies to it.",
    returns: 'An async Express middleware function.',
    sideEffects: ['Counts the request in Redis under rl:user:<user ID>, when there is a user.'],
    tests: [GATEWAY_GUARDS_TEST],
  },
  {
    symbol: 'backend/gateway/src/proxy.ts#FORWARDED_REQUEST_HEADERS',
    status: 'verified',
    summary: 'The request headers a service may see.',
    why: 'Only Content-Type, Accept, Accept-Language and User-Agent are passed on. Everything else, such as Origin and other browser headers, stays at the gateway. The proxy adds X-Request-Id and the internal token itself, and the cookie only for auth. A webhook route adds its own headers on top (PublicRoute.webhook), for that route only.',
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
      'It copies the allowed request headers (plus, for a webhook route, the extra headers listed on that route), sets X-Request-Id to the request ID, and signs an internal token with signInternalToken: the audience is the service, the subject is the user when sessionLookup found one, and `rid` is the request ID.',
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
      'Its routes add sessionRouter, given the Redis client, the Google sign-in check, devLogin, secureCookie, the sign-up grant and the logger, then meRouter.',
      'So it serves POST /sessions, POST /sessions/dev (only when devLogin is on), DELETE /sessions/current, GET and PATCH /me and GET /internal/users/:id. An unknown path with a valid token gets 404.',
      "At startup, index.ts passes two readiness checks (mongo and redis), the imported INTERNAL_PUBLIC_KEY, the Redis client, the Google sign-in check (createFirebaseVerifier, or googleSignInNotSetUp when the Firebase settings are empty), AUTH_DEV_LOGIN as devLogin, secureCookie on when NODE_ENV is production, and billingSignupGrant over an internal client that signs with auth's SERVICE_PRIVATE_KEY and calls BILLING_SERVICE_URL.",
    ],
    why: "Building the app apart from starting it lets tests get the app without startService or a fixed port; supertest serves it on a temporary port. Everything it needs is passed in, so the tests can pass a stand-in for billing's grant. The gateway signs the tokens and forwards the public sign-in, logout and /me routes to it; journey.test.ts runs this app on a port behind the real gateway, with the real billing app behind it.",
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
    why: "The service refuses to start if a setting is missing or invalid, before it connects to anything. It needs MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY and its own SERVICE_PRIVATE_KEY. BILLING_SERVICE_URL defaults to http://localhost:8004. AUTH_DEV_LOGIN (default false) and the three Firebase settings for Google sign-in are optional, except that production needs AUTH_DEV_LOGIN off and all three Firebase settings. PORT, NODE_ENV and LOG_LEVEL have defaults. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads all of it: the log level, NODE_ENV (pretty logs in development, a Secure session cookie in production), the MongoDB and Redis URLs, the keys, billing's URL, the dev sign-in flag, the three Firebase settings (to pick the Google sign-in check) and the port.",
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY, SERVICE_PRIVATE_KEY, BILLING_SERVICE_URL, AUTH_DEV_LOGIN (a boolean), and FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (each a string or undefined).',
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
      "SERVICE_PRIVATE_KEY, auth's own key for calling billing, uses the shared internalPrivateKeySchema: it must parse as an Ed25519 private key. BILLING_SERVICE_URL is an http(s) URL (serviceUrlSchema), default http://localhost:8004.",
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
      "Starting a session records the user in the request context, then asks billing for the sign-up grant (grantSignupCredits). If that fails, it logs the warning 'sign-up credits could not be granted; the next sign-in asks again' and goes on.",
      "It then creates the session in Redis, sets the gilder_sid cookie (HttpOnly, SameSite=Lax, Path=/, Max-Age 30 days, plus Secure when secureCookie is on), logs 'signed in' with the method and whether the user is new, and answers { user } with toProfile.",
      'DELETE /sessions/current needs a user in the internal token (requireUser). It deletes the session the cookie names, clears the cookie and answers 204. Calling it twice, or without a cookie, still gives 204.',
      'Request bodies are checked with validate, so a missing token or a bad email is a 400.',
    ],
    why: "One service owns sessions end to end, so the cookie settings live in one place. Auth's createApp adds the router behind the internal-token check. The gateway maps POST /api/auth/session, POST /api/auth/dev-session and DELETE /api/auth/session onto these paths and passes the Set-Cookie headers back to the browser. The grant is asked for on every sign-in, because billing grants only once per user; a billing outage never blocks a sign-in, and the next sign-in asks again (session-routes.test.ts checks both).",
    returns: 'An Express Router.',
    sideEffects: [
      'Writes and deletes session keys in Redis.',
      'Creates and updates users in MongoDB.',
      'Asks billing for the sign-up grant on every sign-in.',
      'Sets and clears the session cookie.',
    ],
    tests: [AUTH_SESSION_ROUTES_TEST, AUTH_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/auth/src/billing.ts#billingSignupGrant',
    status: 'verified',
    summary: "Asks billing for a user's sign-up credits.",
    why: "It posts to billing's POST /internal/accounts for the user, through an internal client that signs with auth's own key, and allows one retry: billing grants once per user, so asking twice is safe. sessionRouter calls it on every sign-in, so a sign-in that missed the grant (billing down) gets it on the next one. The package exports it as @gilder/auth/billing, so journey.test.ts uses the real one with the real billing app.",
    returns: 'A function from a user ID to a promise that resolves when billing has answered.',
    sideEffects: ["Calls billing's POST /internal/accounts."],
    tests: [AUTH_BILLING_TEST, JOURNEY_TEST],
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
    why: "Sign-in must never create two accounts for one person. `created` tells the caller about a first sign-in, which the 'signed in' log line records; the credits grant does not rely on it, since billing grants once per user whatever auth says. Only the Google sign-in route (POST /sessions) calls it.",
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
      "It calls createService with the name 'chat', the given logger and readiness checks, a JSON body limit of 2 MB (the agent saves whole answers, code files included), `internalAuth` with the gateway's key, the audience 'chat' and, when agentPublicKey is given, the agent as a trusted caller, and routes that add chatRouter, then internalRouter.",
      'So it serves GET and POST /chats, GET, PATCH and DELETE /chats/:id, GET /chats/:id/messages, and the six /internal routes for the agent service.',
      'Only tokens from the gateway or the agent get past the health checks, so a direct call gets 401 on any path. An unknown path with a valid token gets 404.',
      'At startup, index.ts passes one readiness check, mongo, the imported INTERNAL_PUBLIC_KEY and the imported AGENT_PUBLIC_KEY.',
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
      "It extends baseEnvSchema with PORT (default 8002), MONGODB_URI (required, not empty), and INTERNAL_PUBLIC_KEY and AGENT_PUBLIC_KEY (the gateway's and the agent's public keys, both the shared internalPublicKeySchema).",
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: 'The service refuses to start if MONGODB_URI or either key is missing or if any value is invalid, and lists every problem at once, before it connects to anything. PORT, NODE_ENV and LOG_LEVEL have defaults, so leaving them out does not stop it. Node fills process.env from the .env file, through the --env-file-if-exists flag in the package scripts. index.ts reads it for the log level, pretty logs, the MongoDB URL, the two public keys and the port.',
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI, INTERNAL_PUBLIC_KEY and AGENT_PUBLIC_KEY.',
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
      'It returns id, role, content, agent, status, clientMessageId, attachments, fileRefs, artifacts, sources, citations and createdAt.',
      'An agent or clientMessageId that is not set becomes null, so the shape is always the same.',
      'userId, conversationId and supersededBy stay inside the service.',
    ],
    why: "As with toChat, what leaves the service is chosen in one place. The frontend's ChatMessage type has the same shape.",
    returns:
      '{ id, role, content, agent, status, clientMessageId, attachments, fileRefs, artifacts, sources, citations, createdAt }',
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
    why: 'Each user only ever sees and changes their own chats. createApp mounts it behind the internal-token check, and the gateway forwards its six routes from /api/chats. The sidebar list, search, rename, pin and delete call it through RTK Query, and the chat page reads GET /chats/:id and its messages on the server. POST /chats is called by the new-chat page when the first message is sent.',
    returns: 'An Express Router.',
    sideEffects: [
      'POST creates a conversation, PATCH changes its title or pinnedAt, and DELETE sets its deletedAt, in MongoDB.',
    ],
    tests: [CHAT_ROUTES_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/chat/src/internal-routes.ts#internalRouter',
    status: 'verified',
    summary:
      'Routes for the agent service: read a chat, auto-title it, read its recent messages and its last turn, save and fill in messages, and say which chats are gone.',
    how: [
      "Every /internal route needs a token signed with the agent's own key (requireCaller('agent')): the gateway's token gets 403. It also needs a user in the token (requireUser), and every lookup filters by that user, so another user's chat or message gets a 404.",
      'GET /internal/chats/:id answers { chat }.',
      "PATCH /internal/chats/:id takes { title } and renames the chat only while its title is still 'New chat'. It answers { chat, renamed }.",
      'GET /internal/chats/:id/recent-messages returns the latest complete or stopped messages that are not superseded, oldest first: 20 by default, at most 50.',
      'GET /internal/chats/:id/last-turn returns the latest user message that is not superseded and the latest answer after it, whatever their status (either may be null): what regenerate and edit act on.',
      'POST /internal/messages saves a message, with up to 400,000 characters of text. If the chat already has a message with the same clientMessageId, it answers 200 with that message and created: false. If two copies race past that check, the unique index keeps one and the other answers with it.',
      "A new message answers 201 with created: true. It hides the messages listed in supersedes (valid IDs in the same chat only) and moves the chat's lastMessageAt to it.",
      "PATCH /internal/messages/:id fills in content, status, agent, attachments, fileRefs, artifacts, sources or citations; at least one, and nothing else. Once the status is no longer 'streaming', the chat's lastMessageAt moves to now.",
      "POST /internal/chats/deleted takes up to 200 IDs and answers { deleted } with those that are not the user's live chats: deleted, missing, someone else's, or not an ID at all. The agent's file clean-up uses it.",
    ],
    why: "These are the calls the agent makes while it answers (its chatService): check the chat, read its memory, save the user's message and the answer, fill the answer in, and name the chat; and, every ten minutes, find the chats whose files can go. The gateway's route table has no /internal entries, so they cannot be reached from outside (journey.test.ts, SEC-01), and requireCaller keeps the gateway's own token off them too.",
    returns: 'An Express Router.',
    sideEffects: [
      "Creates and updates messages, and changes a chat's title and lastMessageAt, in MongoDB.",
    ],
    tests: [
      CHAT_INTERNAL_ROUTES_TEST,
      AGENT_SERVICES_TEST,
      AGENT_TURNS_TEST,
      AGENT_CLEANUP_TEST,
      JOURNEY_TEST,
    ],
  },
  // -------------------------------------------------------------------------------------------
  // backend/services/billing: accounts, credit holds, the ledger and their routes

  {
    symbol: 'backend/services/billing/src/app.ts#createApp',
    status: 'verified',
    summary:
      "Builds the billing service's Express app: the account, payment and usage routes and the internal credit routes, behind the internal-token check.",
    how: [
      "It calls createService with the name 'billing', the given logger and readiness checks, `internalAuth` with the gateway's key, the audience 'billing' and `callers: callerKeys` (auth and the agent), and routes that add accountRouter, paymentRouter (with the payment gateway and the logger), usageRouter, then internalRouter.",
      'So it serves GET /account, GET /plans, POST /orders, POST /orders/:orderId/verify, GET /payments, POST /webhooks/razorpay, GET /usage/summary, GET /usage/events, POST /internal/accounts and POST /internal/credits/reserve, commit and release. A direct call without a valid token gets 401 on any path except the health checks.',
      "At startup, index.ts passes one readiness check, mongo, the imported INTERNAL_PUBLIC_KEY, and AUTH_PUBLIC_KEY and AGENT_PUBLIC_KEY as the callers' keys, and createRazorpay as payments when all three Razorpay settings are set (otherwise it logs 'payments are off: set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET'). It then starts the stale reservation sweeper, which onShutdown stops before disconnecting MongoDB.",
    ],
    why: "Building the app apart from starting it lets tests get the app without startService or a fixed port. Its app.test.ts sends missing, garbage, forged, misaddressed and expired tokens and checks each gets 401 (SEC-02). The package exports it as @gilder/billing/app, so journey.test.ts and the agent's turn tests run the real billing app on a port.",
    returns:
      'An Express app with /healthz and /readyz open to all, the account, payment, usage and internal routes behind the internal-token check, and the shared 404 and error handling.',
    tests: [
      BILLING_TEST,
      BILLING_CREDITS_TEST,
      BILLING_RESERVATIONS_TEST,
      BILLING_PAYMENTS_TEST,
      JOURNEY_TEST,
    ],
  },
  {
    symbol: 'backend/services/billing/src/env.ts#env',
    status: 'verified',
    summary: "The billing service's environment variables, checked at startup.",
    how: [
      "It extends baseEnvSchema with PORT (default 8004), MONGODB_URI (required, not empty), and three public keys with the shared internalPublicKeySchema: INTERNAL_PUBLIC_KEY (the gateway's), AUTH_PUBLIC_KEY (auth asks for the sign-up grant) and AGENT_PUBLIC_KEY (the agent holds and charges credits).",
      'RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET may be left out, and empty counts as unset; index.ts turns payments on only when all three are set.',
      'loadEnv checks process.env against it when the file is first imported.',
    ],
    why: "The service refuses to start if MONGODB_URI or a key is missing or if any value is invalid, and lists every problem at once, before it connects to anything. `pnpm setup:keys` writes all three keys. Without the Razorpay settings it still starts, logs 'payments are off: ...', and the payment routes answer 503.",
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT (a number), MONGODB_URI, INTERNAL_PUBLIC_KEY, AUTH_PUBLIC_KEY, AGENT_PUBLIC_KEY and the three Razorpay settings (each a string or undefined).',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#PLAN_IDS',
    status: 'verified',
    summary:
      "The plan names an account can have, taken from the shared PLANS: 'free', 'starter', 'pro'.",
    why: 'The accounts model limits its plan field to them, so billing and the shared plan list cannot drift apart.',
    returns: 'An array of plan IDs.',
    tests: [BILLING_MODELS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#RESERVATION_STATUSES',
    status: 'verified',
    summary: "The states of a credit hold: 'held', 'committed' or 'released'.",
    why: "A hold starts as held and ends exactly once: committed when the answer is charged, released when the credits go back. Every change is a conditional update on status 'held', so a hold can never end twice.",
    returns: 'A read-only array of the three statuses.',
    tests: [BILLING_MODELS_TEST, BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#LEDGER_KINDS',
    status: 'verified',
    summary: "The kinds of ledger entry: 'signup_grant', 'purchase', 'usage' and 'adjustment'.",
    why: 'Each credit change says why it happened. Today the code writes signup_grant (grantSignupCredits), usage (commitCredits) and purchase (grantPurchase); adjustment is ready for support.',
    returns: 'A read-only array of the four kinds.',
    tests: [BILLING_MODELS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#accountSchema',
    status: 'verified',
    summary: 'The shape and rules of an account: one per user.',
    how: [
      "_id is the user's ID from auth, so there is one account per user and no second lookup key.",
      "plan is one of PLAN_IDS (default 'free'); planExpiresAt is when a paid plan's badge ends.",
      'balance is a whole number of credits, never below 0 (min 0 and an integer check), default 0.',
      'timestamps adds createdAt and updatedAt.',
    ],
    why: 'The balance is kept on the account so a spend is one conditional update (`balance >= cost`); the ledger keeps the history behind it.',
    tests: [BILLING_MODELS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#reservationSchema',
    status: 'verified',
    summary: 'The shape and rules of a credit hold for one answer.',
    how: [
      'userId, amount (a whole number, at least 1) and agent (one of AGENTS) are required.',
      "status is one of RESERVATION_STATUSES, starting at 'held'.",
      'idempotencyKey (at most 128 characters) is chosen by the caller and unique, so a retried reserve holds the credits once.',
      'An index on { status, createdAt } lets the sweeper find holds left for too long.',
    ],
    why: 'A hold takes the credits off the balance before the AI runs, and settles once the answer ends, so a user can never start more answers than they can pay for.',
    tests: [BILLING_MODELS_TEST, BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#ledgerSchema',
    status: 'verified',
    summary: 'The shape and rules of a ledger entry: one credit change, never edited.',
    how: [
      'userId, delta (a whole, non-zero number: positive adds, negative spends) and kind (LEDGER_KINDS) are required; reservationId, paymentId and metadata (agent, model, tokens, latency for usage) are optional.',
      'Only createdAt is kept; the collection is named ledger.',
      'Partial unique indexes allow one signup_grant entry per user, one usage entry per reservation, and one purchase entry per payment ID (one_purchase_per_payment).',
    ],
    why: 'The ledger is the history behind every balance. The partial unique indexes make a double grant, a double charge or a payment granted twice impossible in the database itself, even when two requests race. The tests check the invariant: balance = the sum of ledger entries − the credits on hold.',
    tests: [BILLING_MODELS_TEST, BILLING_RESERVATIONS_TEST, BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#AccountModel',
    status: 'verified',
    summary: "The Mongoose model for accounts, in billing's database (gilder_billing).",
    why: 'Only billing reads or writes balances; auth and the agent ask it over HTTP. It is built from the mongoose that @gilder/shared re-exports, so it uses the connection connectMongo opens.',
    returns: 'A Mongoose model of Account documents.',
    tests: [BILLING_MODELS_TEST, BILLING_CREDITS_TEST, BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#ReservationModel',
    status: 'verified',
    summary: 'The Mongoose model for credit holds.',
    why: 'reserveCredits creates holds, commitCredits and releaseCredits end them, and the sweeper releases old ones.',
    returns: 'A Mongoose model of Reservation documents.',
    tests: [BILLING_MODELS_TEST, BILLING_RESERVATIONS_TEST, BILLING_SWEEPER_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#LedgerModel',
    status: 'verified',
    summary: 'The Mongoose model for the ledger collection.',
    why: 'grantSignupCredits and commitCredits append to it, each in the same transaction as the balance or hold it goes with.',
    returns: 'A Mongoose model of LedgerEntry documents.',
    tests: [BILLING_MODELS_TEST, BILLING_CREDITS_TEST, BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#toAccount',
    status: 'verified',
    summary: 'Turns an account document into what the API shows of an account.',
    why: "One function decides what leaves the service: plan, planExpiresAt (an ISO string or null) and balance. The frontend's Account type has the same shape.",
    returns: '{ plan, planExpiresAt, balance }',
    tests: [BILLING_MODELS_TEST, BILLING_CREDITS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#toReservation',
    status: 'verified',
    summary: 'Turns a hold into what the credit routes answer with.',
    why: "The agent needs the hold's ID to commit or release it, its amount for the usage event and its status to spot a repeat.",
    returns: '{ id, amount, agent, status }',
    tests: [BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#inTransaction',
    status: 'verified',
    summary: 'Runs some work in one MongoDB transaction.',
    why: 'Every balance change goes with a ledger entry or a hold change, and the two must be saved together or not at all. session.withTransaction retries the work on a transient conflict, and the session is always ended. Transactions need a replica set, which is why MongoDB runs as one even locally.',
    returns: "A promise of the work's result.",
    tests: [BILLING_MODELS_TEST, BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#grantSignupCredits',
    status: 'verified',
    summary: 'Gives a new user their sign-up credits, once.',
    how: [
      'If the user already has a signup_grant ledger entry, it changes nothing.',
      'Otherwise, in one transaction, it writes a signup_grant entry of SIGNUP_CREDITS (100) and adds them to the account, creating it on the free plan if needed (an upsert).',
      'If two sign-ins race, the one-grant-per-user index makes the second fail with a duplicate key, and that one just returns the account.',
    ],
    why: 'Auth asks on every sign-in, so the grant must be safe to ask for again and again; the tests run many grants at once and get exactly one.',
    returns: 'A promise of { account, granted }: granted is false when nothing changed.',
    sideEffects: ['May create an account and a ledger entry in MongoDB.'],
    tests: [BILLING_CREDITS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#reserveCredits',
    status: 'verified',
    summary: "Holds an answer's credits before the AI runs, or refuses with 402.",
    how: [
      'A hold with the same idempotency key is returned as it is (created: false). A key used by another user is a 409 conflict.',
      'The amount comes from CREDIT_COSTS for the agent: the caller never names a price.',
      "In one transaction: one findOneAndUpdate takes the amount off the account only where `balance >= amount`, and a held reservation is created. When no account matches, it reads the balance and throws AppError('insufficient_credits') with a message such as 'This answer needs 10 credits; you have 4': 402.",
      'If the same reserve races, the unique key keeps the first hold and the other returns it.',
    ],
    why: 'The balance check and the decrease are one conditional update, so parallel requests can never overdraw: the SEC-08 test sends 50 reservations at once against 100 credits and gets exactly 10 holds, 40 refusals and a balance of 0.',
    returns: 'A promise of { reservation, balance, created }.',
    sideEffects: ['Lowers the balance and creates a hold, in MongoDB.'],
    tests: [BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#commitCredits',
    status: 'verified',
    summary: 'Charges a held reservation once the answer is done.',
    how: [
      'An ID that cannot be a reservation is a 404, never a database error.',
      'In one transaction it marks the hold committed (only while it is held) and appends a usage ledger entry of minus the amount, with the agent and the usage metadata (model, tokens, latency, chat and message).',
      "A hold that is already committed returns unchanged; one already released is a 409; one that is not the user's is a 404.",
    ],
    why: 'The credits already left the balance at reserve time; committing makes the charge final and records it. Committing twice changes nothing, and the one-usage-per-reservation index backs that up.',
    returns: 'A promise of { reservation, balance }.',
    sideEffects: ['Marks the hold committed and appends a ledger entry, in MongoDB.'],
    tests: [BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#releaseCredits',
    status: 'verified',
    summary: "Gives a held reservation's credits back.",
    how: [
      'An ID that cannot be a reservation is a 404.',
      'In one transaction releaseHeld marks the hold released and adds its amount back to the balance.',
      "A hold already released returns unchanged; one already committed is a 409; one that is not the user's is a 404.",
    ],
    why: 'An answer that failed, or was stopped before its first token, is not charged. No ledger entry is written, because the balance is back where it was.',
    returns: 'A promise of { reservation, balance }.',
    sideEffects: ['Marks the hold released and raises the balance, in MongoDB.'],
    tests: [BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#releaseHeld',
    status: 'verified',
    summary: 'Releases one hold that is still held, inside a given transaction.',
    why: 'The status check is part of the update, so a hold is released at most once however many callers try. releaseCredits uses it for one hold, and the sweeper for each stale one.',
    returns: 'A promise of the released hold, or null when none was still held.',
    sideEffects: ['Marks the hold released and adds its amount back to the balance.'],
    tests: [BILLING_RESERVATIONS_TEST, BILLING_SWEEPER_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#settledAlready',
    status: 'verified',
    summary: 'Decides what a commit or release of a hold that is no longer held means.',
    why: "The same outcome again is a no-op, so a retried call is safe; the opposite outcome is a 409 'This reservation was already <status>'; and a hold that is not the user's is a 404 'No such reservation', so one user cannot learn about another's holds.",
    returns: 'A promise of { reservation, balance }, or an AppError.',
    tests: [BILLING_RESERVATIONS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/internal-routes.ts#internalRouter',
    status: 'verified',
    summary:
      'The routes auth and the agent call: the sign-up grant, and holding, charging and releasing credits.',
    how: [
      'Every /internal route needs a user in the token (requireUser) and names the one service allowed to call it (requireCaller): any other signer, the gateway included, gets 403.',
      'POST /internal/accounts (auth only) grants the sign-up credits: 201 { account, granted: true } the first time, 200 with granted: false after.',
      'POST /internal/credits/reserve (agent only) takes { agent, idempotencyKey } (8 to 128 characters) and answers 201 for a new hold, 200 for a repeat, or 402.',
      'POST /internal/credits/commit takes { reservationId, metadata } and /internal/credits/release { reservationId }, both for the agent only.',
      'The bodies are strict: an amount or any other field is a 400. The credit routes answer { reservation, balance }.',
    ],
    why: "The gateway never forwards /internal routes, and requireCaller keeps auth's key off the credit routes and the agent's off the grant. Each route acts for the user in the token.",
    returns: 'An Express Router.',
    sideEffects: ['Creates and changes accounts, holds and ledger entries in MongoDB.'],
    tests: [BILLING_CREDITS_TEST, BILLING_RESERVATIONS_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/billing/src/account-routes.ts#accountRouter',
    status: 'verified',
    summary: "GET /account: the signed-in user's plan and balance.",
    why: 'The gateway forwards GET /api/billing/account here for the credits card, and the agent reads it before a turn to refuse a user with no credits. A user with no account yet (the grant failed while billing was down) gets the free plan with 0 credits until the next sign-in creates it.',
    returns: 'An Express Router.',
    tests: [BILLING_CREDITS_TEST, JOURNEY_TEST],
  },
  {
    symbol: 'backend/services/billing/src/sweeper.ts#STALE_RESERVATION_MS',
    status: 'verified',
    summary: 'How old a hold must be before the sweeper gives it back: 10 minutes.',
    why: 'Answers end long before this, so only holds an agent left behind, for example after a crash mid-answer, are this old.',
    returns: '600,000 milliseconds.',
    tests: [BILLING_SWEEPER_TEST],
  },
  {
    symbol: 'backend/services/billing/src/sweeper.ts#releaseStaleReservations',
    status: 'verified',
    summary: 'Releases every hold still held after 10 minutes.',
    how: [
      'It finds held reservations created before the cutoff, oldest first, 100 at a time.',
      'Each one is released in its own transaction with releaseHeld, which only acts while the hold is still held.',
      'It goes on until a batch comes back short, and returns how many it released.',
    ],
    why: 'Safe on several billing instances at once: each hold is given back exactly once (the test runs sweeps side by side). Recent holds and finished ones are left alone.',
    returns: 'A promise of the number released.',
    sideEffects: ['Marks holds released and raises balances, in MongoDB.'],
    tests: [BILLING_SWEEPER_TEST],
  },
  {
    symbol: 'backend/services/billing/src/sweeper.ts#startReservationSweeper',
    status: 'verified',
    summary: 'Runs the stale-hold sweep every minute, never two at once.',
    why: "billing's index.ts starts it at startup and stops it on shutdown. A run that finds work logs 'released stale credit reservations' with the count; a failure is logged at error and the next run tries again. The timer is unref'd, so it never keeps the process alive on its own.",
    returns: 'A function that stops the sweeper.',
    sideEffects: ['Sets an interval timer.'],
    tests: [BILLING_SWEEPER_TEST],
  },

  // Buying credits and usage

  {
    symbol: 'backend/services/billing/src/models.ts#PAYMENT_STATUSES',
    status: 'verified',
    summary: "A payment's two states: 'created' and 'paid'.",
    why: 'An order starts as created when billing makes it, and becomes paid once, in the grant. There is no failed state: an order nobody paid stays created.',
    returns: "A read-only array: ['created', 'paid'].",
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#paymentSchema',
    status: 'verified',
    summary: 'The shape and rules of a payment: one Razorpay order for one plan.',
    how: [
      "userId, orderId (Razorpay's order), plan (PLAN_IDS), amountPaise and credits (whole numbers of at least 1) are required; status is created by default; paymentId and paidAt are set once it is paid.",
      'orderId is unique, and so is paymentId among the payments that have one (a partial index), so one payment can never pay for a second order.',
      'An index on userId and createdAt (newest first) serves the payment history.',
    ],
    why: 'The record fixes what the user is owed when the order is made from the plan config, so the grant never takes an amount or a credit count from the browser or the webhook.',
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#webhookEventSchema',
    status: 'verified',
    summary: "A webhook delivery already handled, stored under Razorpay's event ID.",
    how: [
      'The _id is the x-razorpay-event-id header and type the event name; receivedAt is its only time. The collection is named webhookEvents.',
    ],
    why: 'Inserting the event ID fails with a duplicate key the second time, so a redelivered event is caught in one write, with no read first.',
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#PaymentModel',
    status: 'verified',
    summary: 'The Mongoose model for payments (paymentSchema).',
    why: 'POST /orders creates one per order, grantPurchase marks it paid, and GET /payments lists them.',
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#WebhookEventModel',
    status: 'verified',
    summary: 'The Mongoose model for handled webhook events (webhookEventSchema).',
    why: 'The webhook route creates one per delivery; a duplicate key means the event was handled before.',
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/models.ts#toPayment',
    status: 'verified',
    summary: 'What the API shows of a payment.',
    how: [
      'It keeps the order ID, plan, amount in paise, credits and status, with createdAt and paidAt as ISO strings (paidAt is null until paid).',
    ],
    why: "The user ID and Razorpay's payment ID stay inside billing; the payment history needs neither.",
    returns: 'A PaymentView.',
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/razorpay.ts#signaturesMatch',
    status: 'verified',
    summary: 'Compares two signatures in constant time.',
    how: [
      'The expected signature is read as hex. The given one is read as hex when it looks like hex, and as text otherwise.',
      'Different lengths are a mismatch at once; equal lengths are compared with timingSafeEqual.',
    ],
    why: 'A normal comparison stops at the first wrong character, so its timing could reveal how much of a guess is right. timingSafeEqual takes the same time whatever matches.',
    returns: 'true when they match.',
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/razorpay.ts#createRazorpay',
    status: 'verified',
    summary: "Billing's Razorpay client: create an order, and check the two kinds of signature.",
    how: [
      "createOrder posts the amount in paise, the currency INR, a receipt and notes to https://api.razorpay.com/v1/orders, with the key ID and secret as Basic auth and a 10-second limit. No answer is a 503 'Payments are not reachable right now'; an error status is a 503 that names it.",
      "verifyCheckout checks the checkout's signature: an HMAC-SHA256 of '<order ID>|<payment ID>' with the key secret.",
      'verifyWebhook checks a webhook: an HMAC-SHA256 of the raw body with the webhook secret.',
      'Both compare with signaturesMatch. keyId is passed on to the browser for the checkout.',
    ],
    why: 'fetch and node:crypto are enough for one call and two HMACs, so there is no Razorpay SDK. The tests replace only createOrder and keep the real signature checks.',
    returns: 'A PaymentGateway.',
    sideEffects: ['createOrder calls Razorpay over HTTPS.'],
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/credits.ts#grantPurchase',
    status: 'verified',
    summary:
      "Grants a paid order's credits once, whoever reports the payment first: the browser's check or Razorpay's webhook.",
    how: [
      "It finds the payment by its order ID. When a user ID is given (the browser's check), the payment must be that user's; otherwise, or when there is no such order, it throws not_found 'No such order'.",
      'In one transaction it moves the payment from created to paid, with the payment ID and paidAt, only if it is still created. If it was already paid, nothing else happens and granted is false.',
      "Otherwise it appends a purchase ledger entry with the plan's credits, the payment ID and the order, raises the balance, and sets the plan and planExpiresAt: the plan's validity days (30) from now, or from the current end if the badge is still running.",
      'When two reports arrive at the same moment, the one_purchase_per_payment index makes the second insert fail with a duplicate key; its transaction is undone and it returns granted false.',
    ],
    why: 'Razorpay can report a payment more than once and the browser once more, in any order; the credits must arrive exactly once (SEC-05). The credits come from the payment record, fixed from the plan config when the order was made.',
    returns:
      '{ account, granted }: the account as it now is, and whether this call granted the credits.',
    sideEffects: ['Updates a payment, appends a ledger entry and updates an account, in MongoDB.'],
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/payment-routes.ts#paymentRouter',
    status: 'verified',
    summary:
      "Buying credits: the plans, orders priced by the server, the browser's payment check, the payment history and Razorpay's webhook.",
    how: [
      'GET /plans lists Starter and Pro from PLANS (name, price in paise, credits and validity days), with currency INR and testMode true.',
      "POST /orders takes a strict { planId: 'starter' | 'pro' }, creates a Razorpay order for the plan's price and saves a created payment. It answers 201 with the order and the key ID.",
      "POST /orders/:orderId/verify takes a strict { paymentId, signature }, checks the checkout signature (400 'The payment could not be verified' when it is wrong) and grants with the user's ID (grantPurchase). It answers the account and granted.",
      "GET /payments lists the user's last 50 paid payments, newest first (toPayment). A checkout that was opened and closed stays stored, because a late webhook (a slow UPI payment) can still pay it, but is not listed.",
      "POST /webhooks/razorpay needs no user. It checks x-razorpay-signature over the raw body (rawBodyOf; 400 when wrong), stores x-razorpay-event-id once (a repeat answers { ok: true, duplicate: true }), and grants a payment.captured event for the order's owner. An unknown order is logged at warn; anything correctly signed gets 200.",
      "Every route but the webhook needs a user. Without a payment gateway, the routes that use it answer 503 'Payments are not set up on this server'.",
    ],
    why: 'The price never comes from the browser, and nothing is granted without a signature only Razorpay can make. The webhook covers a browser that closed right after paying, and one shared grant makes the two reports safe together.',
    returns: 'An Express Router.',
    sideEffects: [
      'Creates orders at Razorpay; creates and updates payments, webhook events, ledger entries and accounts in MongoDB.',
    ],
    tests: [BILLING_PAYMENTS_TEST, GATEWAY_TEST],
  },
  {
    symbol: 'backend/services/billing/src/usage-routes.ts#usageRouter',
    status: 'verified',
    summary: "The usage page's data, from the ledger's usage entries.",
    how: [
      "GET /usage/summary takes days (1 to 90, default 30) and tz (a time zone the runtime knows, default UTC). Two aggregations at once sum the user's usage entries in the window: by the agent in their metadata (credits and answers, largest first) and by calendar day in tz.",
      'It answers the window, the total credits, byAgent (an entry with no agent counts as chat) and byDay, which lists only the days that had usage.',
      'GET /usage/events lists the latest usage entries, newest first: limit from 1 to 100 (default 30), and an optional before time to page back. Each has its ID, time, credits, agent, model, input and output tokens, time taken and chat, with null for what is missing.',
    ],
    why: "commitCredits already writes each answer's agent, model, tokens and time into its ledger entry, so usage needs no store of its own and always matches the balance. Grouping the days in the viewer's zone keeps the last day on the chart their today.",
    returns: 'An Express Router.',
    tests: [BILLING_PAYMENTS_TEST],
  },
  {
    symbol: 'backend/services/billing/src/usage-routes.ts#isTimeZone',
    status: 'verified',
    summary: 'True for any time zone name the runtime knows, aliases included.',
    how: [
      'It tries to build an Intl.DateTimeFormat with the zone, and returns false when that throws.',
    ],
    why: 'Per its comment, the list from Intl.supportedValuesOf leaves out aliases such as Asia/Kolkata, which browsers report, so that list cannot be the check. The tests send Asia/Kolkata (accepted) and Mars/Base (a 400).',
    returns: 'true or false.',
    tests: [BILLING_PAYMENTS_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/services/agent: the turn route

  {
    symbol: 'backend/services/agent/src/app.ts#createApp',
    status: 'verified',
    summary:
      "Builds the agent service's Express app: the answer and file routes, behind the internal-token check.",
    how: [
      "It calls createService with the name 'agent', the given logger and readiness checks, and `internalAuth: { publicKey: internalPublicKey, audience: 'agent' }`: only the gateway's tokens are trusted.",
      'When `turns` is given, its routes add turnRouter (send, regenerate, edit and stop) with those dependencies and the logger, and when `files` is given, fileRouter (uploads, details and download links); without either the app has no routes.',
      "At startup, index.ts builds the model layer (createLlm over buildProviders, with llmCallRecorder as its telemetry hook), chat and billing clients that sign with the agent's SERVICE_PRIVATE_KEY, the stop signals (createStopSignals) and the agents (buildAgents, with Tavily search, mock search in mock mode, or none, and, when it has storage, the PDF question, image question and file-making tools), logs 'agents ready' with their names, and passes them with two readiness checks (mongo and redis), the imported INTERNAL_PUBLIC_KEY, the Redis memory and the Redis client. It also picks the file store (createS3FileStore when all four S3 settings are set; otherwise it logs 'uploads are off: ...'), the embedder (Gemini in live mode with GEMINI_API_KEY, mockEmbedder otherwise) and the vector store (Qdrant when QDRANT_URL is set, in memory otherwise), starts the file clean-up (startFileCleanup), and gives fileRouter the file store, the chat client and an onPdfReady that indexes a ready PDF (indexPdf) without waiting. On shutdown it stops the file clean-up, then closes the stop signals.",
    ],
    why: 'Building the app apart from starting it lets tests pass a scripted mock model, a test Redis and the real chat and billing apps (turns.test.ts). Its app.test.ts checks the SEC-02 token cases. The gateway forwards POST /api/chats/:id/messages, the regenerate and edit routes, POST /api/turns/:turnId/stop and the four /api/files routes here.',
    returns:
      'An Express app with /healthz and /readyz open to all, the answer and file routes behind the internal-token check, and the shared 404 and error handling.',
    tests: [AGENT_TEST, AGENT_TURNS_TEST, AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/env.ts#env',
    status: 'verified',
    summary: "The agent service's environment variables, checked at startup.",
    how: [
      'It is one line, `loadEnv(agentEnvSchema)`: the settings and their rules live in env-schema.ts.',
      'loadEnv checks process.env against that schema when the file is first imported.',
    ],
    why: "The service refuses to start if a setting is missing or invalid, before it connects to anything. index.ts reads the log level, the MongoDB and Redis URLs, the keys, chat's and billing's URLs, LLM_MODE, the AI provider keys and TAVILY_API_KEY. Its .env.example also lists QDRANT_URL and the S3 settings for later features, which the schema does not read yet.",
    returns:
      'An object with NODE_ENV, LOG_LEVEL, PORT, MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY, SERVICE_PRIVATE_KEY, CHAT_SERVICE_URL, BILLING_SERVICE_URL, LLM_MODE, and GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY and TAVILY_API_KEY (each a string or undefined).',
    sideEffects: [
      'Reads process.env.',
      'Throws an EnvError on import if anything is invalid, which stops the app.',
    ],
  },
  {
    symbol: 'backend/services/agent/src/env-schema.ts#agentEnvSchema',
    status: 'verified',
    summary: "The agent's settings and the rules between them, as a Zod schema.",
    how: [
      'It extends baseEnvSchema with PORT (default 8003), MONGODB_URI and REDIS_URL (required), INTERNAL_PUBLIC_KEY, and SERVICE_PRIVATE_KEY, its own key for calling chat and billing.',
      'CHAT_SERVICE_URL and BILLING_SERVICE_URL default to http://localhost:8002 and :8004.',
      'LLM_MODE is live (real providers) or mock (canned answers, no keys), default mock.',
      'GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY and TAVILY_API_KEY may be left out; empty counts as unset. Without TAVILY_API_KEY, the search agent is off in live mode.',
      'AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (file storage: all four, or uploads stay off) and QDRANT_URL (the vector store) may be left out too.',
      'In live mode GROQ_API_KEY is required, because chat, routing and titles run on Groq. The other keys only turn on the providers that need them.',
    ],
    why: 'The app runs in tests and CI without any AI keys, and refuses to start in live mode with no way to answer. The schema lives apart from env.ts so tests can check the rules without a real environment.',
    returns: 'A Zod object schema, with a superRefine for the live-mode rule.',
    tests: [AGENT_ENV_SCHEMA_TEST],
  },
  {
    symbol: 'backend/services/agent/src/turns.ts#turnRouter',
    status: 'verified',
    summary:
      'The answer routes: send a message, regenerate or edit the latest turn, and stop an answer.',
    how: [
      'Every route needs a user in the token (requireUser) and checks its params and a strict body with validate.',
      "POST /chats/:chatId/turns takes { content, clientMessageId, agent?, attachments? } (up to 4 file IDs), refuses a shortcut with nothing after it (400), loads the chat through chat (someone else's is a 404), and runs runTurn with a plan that routes the message and loads the memory cache.",
      "POST /chats/:chatId/messages/:messageId/regenerate takes { clientMessageId }. It asks chat for the last turn: only the latest answer, and not while it is still being written, can be regenerated (409 otherwise). The plan keeps the old answer's agent and the user message's attachments, builds the memory without the old turn and makes the new answer supersede the old.",
      "POST /chats/:chatId/messages/:messageId/edit takes the same body as a new message. Only the user's latest message can be edited (409 otherwise); the plan routes the new text and makes it supersede the old message and its answer.",
      "POST /turns/:turnId/stop asks the stop signals to stop that turn for this user: 202 { stopping: true }, or 404 'No answer is being written for this turn'.",
    ],
    why: 'Send, regenerate and edit differ only in their TurnPlan, so the checks, the credits and the streaming live once, in runTurn. The gateway forwards each route from /api.',
    returns: 'An Express Router.',
    sideEffects: [
      'Sets and removes lock and turn keys in Redis, and publishes stops.',
      'Holds, charges or releases credits in billing, and saves and fills in messages in chat.',
    ],
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/turns.ts#runTurn',
    status: 'verified',
    summary:
      'The core every turn shares: the checks, the credit hold and the saved messages, then the stream.',
    how: [
      "A Redis lock (turn-lock:<chat>:<client ID>, 15 minutes, set only if absent) refuses a second copy of the same request with 409 'This message is already being answered'.",
      "Below the price of a chat answer, it refuses with 402 'You are out of credits' before any AI call, the router's included (SEC-03).",
      "It checks the attached files (resolveAttachments): 404 or 409 when one is not the user's, not from this chat, not ready, or a PDF still being read. It notes whether the chat has any ready PDF.",
      "It loads the plan's memory before saving anything, so the question is not in it twice, then routes the message with the kinds of files attached and whether the chat has a ready PDF, or keeps a fixed agent for a regenerate (chat if that agent no longer runs).",
      "It applies the agent's per-minute limit (hitRateLimit with AGENT_RATE_LIMITS under rl:agent-<agent>): over it, 429 with Retry-After, before anything is charged.",
      "It holds the credits with the plan's reserve key: 402 when too few for that agent, 409 'This message was already answered' when the key's hold is no longer held.",
      "It saves the user's message with its attachments (unless the plan answers an existing one) and an empty 'streaming' answer, each with the messages they supersede; if saving fails, the hold is released.",
      'Then streamAnswer streams and settles. The lock is always removed at the end.',
    ],
    why: 'Everything that can refuse the request happens before the stream starts, so refusals are ordinary problem+json errors and cost nothing.',
    returns: 'A promise that resolves when the turn is over.',
    sideEffects: [
      'Sets and removes a lock key, and counts the per-agent limit, in Redis.',
      'Holds credits in billing and saves messages in chat.',
    ],
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/turns.ts#historyWithout',
    status: 'verified',
    summary: "The chat's finished messages, fresh from chat, without the ones being replaced.",
    why: 'Regenerate and edit must not show the model the turn they replace. It reads recent-messages from chat rather than the cache, drops the replaced IDs and trims the rest to the memory budget.',
    returns: 'A promise of the messages for the model.',
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/turns.ts#requireText',
    status: 'verified',
    summary: 'Refuses a message that was only a shortcut.',
    why: "A message like '/search' with nothing after it has nothing to answer: 400 'Write a message after the shortcut'.",
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/turns.ts#streamAnswer',
    status: 'verified',
    summary: 'Streams one answer as server-sent events, then saves it and charges it.',
    how: [
      'It opens the event stream, registers the answer with the stop signals under its answer ID, and aborts the answer if the client goes away before the end.',
      "It sends meta (the turn and message IDs) and agent (the agent and why it was chosen), and starts titling a new chat (title 'New chat') at the same time.",
      'It runs the agent with the user, the chat, the attachments and the answer ID, and sends each piece of text as a token event, sources as a sources event, code files as an artifact event, PDF passages as a citations event, each part of making a file as a progress event, and each file made as a file event.',
      'Once the answer is done: it fills in the answer as complete with its sources, code files, citations and the IDs of the files it made (fileRefs), commits the credits with the model, tokens, latency, chat and message, sends usage (credits charged and the new balance), appends the turn to the memory cache (or drops the cache when regenerate or edit changed the history), sends the title if one was made, and sends done.',
      'It always unregisters the answer from the stop signals.',
      'Anything that goes wrong, a stop included, goes to settleUnfinished.',
    ],
    why: 'The browser sees the answer as it is written, and the credits are only charged for an answer that finished.',
    returns: 'A promise that resolves when the stream is closed.',
    sideEffects: ['Writes events to the response, and calls chat and billing.'],
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/turns.ts#settleUnfinished',
    status: 'verified',
    summary: "Ends an answer that didn't finish: keeps the partial text and settles the credits.",
    how: [
      "It saves the text so far, with status 'stopped' for a stop and 'failed' otherwise, and keeps any sources.",
      'A stop after text started is charged (commit, and a usage event); a stop before it, or any failure, is released.',
      "It drops the chat's memory cache, so the next turn reloads it from chat.",
      'If settling fails, it logs the error; the sweeper later releases a hold left behind.',
      "For a failure (not a stop) it logs 'the answer failed' and sends an error event: the AppError's code and message, or answer_failed with 'The answer failed. Your credits were not charged.', and the request ID. It always ends with done.",
    ],
    why: 'The user pays only for text they received, and the stream always ends cleanly, even when billing or chat is down.',
    returns: 'A promise that resolves when done.',
    sideEffects: [
      'Updates the answer in chat, commits or releases the hold in billing, and deletes the memory key in Redis.',
    ],
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/event-stream.ts#openEventStream',
    status: 'verified',
    summary: 'Turns a response into a server-sent events stream.',
    how: [
      'It sets 200 with text/event-stream, Cache-Control no-cache, no-transform and X-Accel-Buffering: no, and flushes the headers.',
      'send writes a named event with JSON data, only while the response is still open.',
      "A ': ping' comment goes out every 15 seconds, so proxies and browsers keep a quiet connection open while the model thinks.",
      'close stops the heartbeat and ends the response.',
    ],
    why: 'One place sets the headers that stop proxies from buffering or compressing a stream.',
    returns: 'An EventStream with send, open and close.',
    sideEffects: ['Writes to the response; sets an interval timer.'],
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/services.ts#chatService',
    status: 'verified',
    summary: "The agent's typed calls to chat's /internal routes.",
    how: [
      'getChat and recentMessages read GET /internal/chats/:id and /recent-messages (each message keeps its ID, role and content), and lastTurn reads /last-turn, the latest user message and its answer.',
      'saveMessage posts to /internal/messages, and retries only when the message has a clientMessageId, because chat saves such a message once.',
      'updateMessage patches /internal/messages/:id and autoTitle patches /internal/chats/:id; both may retry.',
      'deletedChats posts up to 200 chat IDs to /internal/chats/deleted and returns the ones that are gone for the user, for the file clean-up; it may retry.',
    ],
    why: "Each call goes through an internal client signed with the agent's own key for the user it acts for, so chat checks both the caller and the user.",
    returns: 'A ChatService.',
    tests: [AGENT_SERVICES_TEST, AGENT_TURNS_TEST, AGENT_CLEANUP_TEST],
  },
  {
    symbol: 'backend/services/agent/src/services.ts#billingService',
    status: 'verified',
    summary: "The agent's typed calls to billing.",
    how: [
      'balance reads GET /account.',
      'reserve, commit and release post to /internal/credits/reserve, commit and release.',
      'Every call may retry once: a reserve has its idempotency key, and a hold ends only once.',
    ],
    why: 'A 402 from billing comes back as the same AppError, so the turn route can pass it to the browser unchanged.',
    returns: 'A BillingService.',
    tests: [AGENT_SERVICES_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/memory.ts#MEMORY_MESSAGES',
    status: 'verified',
    summary: 'How many recent messages the memory keeps: 20.',
    why: 'Enough for the model to follow the conversation; trimToBudget then keeps only what fits.',
    returns: 'The number 20.',
    tests: [AGENT_MEMORY_TEST],
  },
  {
    symbol: 'backend/services/agent/src/memory.ts#trimToBudget',
    status: 'verified',
    summary: 'Keeps the newest messages that fit a character budget, in their order.',
    why: "A long chat must never overflow the model's context. The default budget is 24,000 characters, about 6,000 tokens, leaving room for the answer. It stops at the first message that does not fit, counting back from the newest.",
    returns: 'The messages that fit, oldest first.',
    tests: [AGENT_MEMORY_TEST],
  },
  {
    symbol: 'backend/services/agent/src/memory.ts#createMemory',
    status: 'verified',
    summary: "A chat's recent messages for the model, cached in Redis.",
    how: [
      'load reads the Redis list mem:<chatId>. When it is empty, it asks chat for the latest finished messages, keeps the last 20 and caches them for an hour in one MULTI.',
      'append adds a finished turn to the cache only when the cache exists, and keeps the last 20.',
      'forget deletes the cache.',
      'What load returns is trimmed with trimToBudget.',
    ],
    why: 'Most turns then skip the call to chat. The turn route appends after a finished answer, and forgets after an unfinished one or after regenerate or edit, so the cache never holds a turn chat does not have.',
    returns: 'A Memory with load, append and forget.',
    sideEffects: ['Reads and writes mem:<chatId> in Redis, with a one-hour expiry.'],
    tests: [AGENT_MEMORY_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/routing.ts#parseShortcut',
    status: 'verified',
    summary: 'Takes a shortcut such as /search off the start of a message.',
    why: 'A user can type /search, /code, /pdf, /slides or /image to choose the agent. Any other text, an unknown shortcut included, is left alone.',
    returns: '{ text, shortcut? }: the message without its shortcut, and the agent it names.',
    tests: [AGENT_ROUTING_TEST],
  },
  {
    symbol: 'backend/services/agent/src/routing.ts#routeMessage',
    status: 'verified',
    summary: 'Picks the agent for a message.',
    how: [
      'An agent the user chose (a chip or a shortcut) wins; then an attached PDF or image picks the Q&A agent.',
      'Otherwise the router model is asked for JSON { agent, confidence } through completeJson, with the message inside <message> tags (at most 4,000 characters) and a prompt that says never to follow instructions in it (routerPrompt). pdf_qa is offered only when the chat has a ready PDF, and a pdf_qa reply without one becomes chat.',
      'A confidence below 0.6, an invalid reply or a failed call goes to chat; a stop is passed on.',
      'An agent this server does not run also becomes chat.',
    ],
    why: 'Chat is the cheapest agent, so a routing problem never costs the user more. Chat and code always run; search runs only with web search (a Tavily key, or mock mode), and the file agents only with storage. Regenerate skips routing and keeps the old agent.',
    returns: '{ agent, reason }: the reason is chosen, attachment, router or default.',
    tests: [AGENT_ROUTING_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/structured.ts#completeJson',
    status: 'verified',
    summary: 'Asks a model for JSON and checks it against a schema, with one repair.',
    why: "A reply that does not parse or does not fit gets one more try, with the model shown its reply and the problem. A second failure is AppError('service_unavailable', 'The AI returned an answer in the wrong format'), never an unchecked object passed along. routeMessage uses it.",
    returns: 'A promise of { value, result }.',
    tests: [AGENT_STRUCTURED_TEST],
  },
  {
    symbol: 'backend/services/agent/src/title.ts#generateTitle',
    status: 'verified',
    summary: 'A short title for a new chat, from its first message.',
    why: "The title model gets the message inside <message> tags (at most 2,000 characters) and a prompt asking for at most six words. The turn route runs it while the answer streams and saves it with chat's auto-title route, which keeps a title the user chose.",
    returns: 'A promise of the title, or null.',
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/title.ts#cleanTitle',
    status: 'verified',
    summary: "Turns a model's reply into a clean title.",
    why: "Models add quotes, a 'Title:' label or a full stop. It keeps the first line, strips those, cuts to 60 characters, and gives null when nothing is left.",
    returns: 'The title, or null.',
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/chat.ts#chatAgent',
    status: 'verified',
    summary:
      'Everyday answers: the fixed prompt, the conversation so far and the new message, streamed from the chat model.',
    why: 'The everyday agent, and the one every unclear route falls back to. The system prompt is fixed in code (CHAT_SYSTEM_PROMPT), so nothing a user writes can change it. Its call is tagged with the agent and the answer ID for telemetry.',
    returns: 'An AgentRunner whose run streams model, token and usage events.',
    tests: [AGENT_CHAT_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/chat.ts#CHAT_SYSTEM_PROMPT',
    status: 'verified',
    summary: "The chat agent's system prompt.",
    why: "It asks for clear, concise answers with Markdown where it helps, and to say so when unsure instead of guessing. It also says that this assistant makes PDFs, decks and images: an earlier answer starting 'Here is your PDF' (deck, image) is a file it made and wrote itself, without looking anything up. Files are made by other agents, so without this the model denied having made one when asked about it.",
    returns: 'A string.',
    tests: [AGENT_CHAT_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/index.ts#buildAgents',
    status: 'verified',
    summary:
      'The agents this server runs: chat and code always, and the others when their tools are there.',
    how: [
      'search needs web search: Tavily in live mode with TAVILY_API_KEY, canned search in mock mode.',
      'pdf_qa needs the document search tools (the embedder, the vector store and readyDocuments), and pdf, slides and image need the generate tools (storage, a way to draw images and the mode). index.ts passes both only when the agent has storage.',
      'image_qa needs a way to read images, which index.ts passes with storage, in mock mode or with GEMINI_API_KEY.',
    ],
    why: 'An agent without what it needs is simply not there, and routing sends its questions to chat. The turn route looks the routed agent up here and falls back to chat.',
    returns: '{ chat, code, search?, pdf_qa?, image_qa?, pdf?, slides?, image? }',
    tests: [AGENT_TURNS_TEST, AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/index.ts#availableAgents',
    status: 'verified',
    summary: 'The names of the agents buildAgents made.',
    why: "routeMessage turns any agent not in this set into chat, so a route never points at an agent that is not running. index.ts also logs them at startup ('agents ready').",
    returns: 'A read-only Set of agent names.',
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/search.ts#createSearchAgent',
    status: 'verified',
    summary: 'Answers from the web: a search, the sources, then an answer that cites them.',
    how: [
      'It makes the query (searchQuery), searches, and yields the numbered sources before any text.',
      "It then streams the 'write' model with SEARCH_SYSTEM_PROMPT, the memory, and the sources inside <sources> tags followed by the question, through plainCitationMarks, so a 【1】 the model writes arrives as [1].",
      'Both model calls are tagged with the agent and the answer ID for telemetry.',
    ],
    why: 'The results are untrusted text from other sites, so they go in a fenced data block the model is told never to take instructions from.',
    returns: 'An AgentRunner for search.',
    tests: ['backend/services/agent/src/agents/search.test.ts', AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/search.ts#SEARCH_SYSTEM_PROMPT',
    status: 'verified',
    summary: "The search agent's system prompt.",
    why: 'It asks for answers from the numbered sources, cited inline as [1], [2] with plain brackets, only numbers that exist; to say so when the sources do not answer; and never to follow instructions found in the sources.',
    returns: 'A string.',
    tests: ['backend/services/agent/src/agents/search.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/agents/search.ts#searchQuery',
    status: 'verified',
    summary: 'The query to search: the message, or a standalone version of it.',
    why: "With no earlier messages it is the message (first 400 characters). With history, the small 'title' model rewrites it as one query of at most 12 words from the last six messages, since a follow-up makes no sense to a search engine alone. If that fails, the message is used; a stop is passed on.",
    returns: 'A promise of the query.',
    tests: ['backend/services/agent/src/agents/search.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/search/web-search.ts#createTavilySearch',
    status: 'verified',
    summary: 'Web search with Tavily.',
    why: "It posts the query (at most 400 characters) to Tavily's basic search for 5 results with images, gives up after 10 seconds or when the turn stops, and turns the results into sources. A failure, or a non-OK answer, is a 503 service_unavailable ('Web search is not available right now').",
    returns: 'A WebSearch function.',
    sideEffects: ['Calls the Tavily API.'],
  },
  {
    symbol: 'backend/services/agent/src/search/web-search.ts#toSources',
    status: 'verified',
    summary: 'Turns raw search results into numbered, trimmed sources.',
    why: 'Only results with an http(s) link of at most 2,000 characters are kept, at most 5, numbered from 1. Titles are cut to 200 characters (the host name when missing), snippets to 700, and an image is kept only if it is an http(s) link. Only safe, short links reach the model and the page.',
    returns: 'An array of { n, title, url, snippet, image? }.',
    tests: ['backend/services/agent/src/search/web-search.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/search/web-search.ts#mockWebSearch',
    status: 'verified',
    summary: 'Canned search results for mock mode.',
    why: 'Two example sources that mention the query, so search runs in development, tests and CI without a Tavily key.',
    returns: 'A promise of two sources.',
    tests: ['backend/services/agent/src/search/web-search.test.ts', AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/code.ts#codeAgent',
    status: 'verified',
    summary: 'Code files: streamed as Markdown, then sent as files.',
    why: "It streams the 'code' model with CODE_SYSTEM_PROMPT, the memory and the request, passing every event on, so the user sees the code as it is written. When the stream ends it parses the text with parseCodeFiles and, if any files came out, yields them as an artifact.",
    returns: 'An AgentRunner for code.',
    tests: ['backend/services/agent/src/agents/code.test.ts', AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/code.ts#CODE_SYSTEM_PROMPT',
    status: 'verified',
    summary: "The code agent's system prompt: the format its files are written in.",
    why: "It asks for a sentence or two on what was built, then each file as a level-3 heading with its relative path in backticks and one fenced block with the language; at most 10 files under 200 KB each; an index.html loading style.css and script.js for anything a browser can show; and a short 'How to run'. That format is what parseCodeFiles reads.",
    returns: 'A string.',
    tests: ['backend/services/agent/src/agents/code.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/agents/code-files.ts#parseCodeFiles',
    status: 'verified',
    summary: 'Finds the files in a code answer and checks them.',
    how: [
      'It finds every heading (## to ####) holding a path, followed by a fenced block.',
      'Each file is checked with codeFileSchema; one that fails is skipped.',
      "The language is the fence's, or guessed from the extension, or text.",
      'A later file with the same name replaces an earlier one, and at most 10 are kept.',
    ],
    why: 'The files are model output, so their paths and sizes are checked before anyone downloads them.',
    returns: 'An array of { name, language, content }.',
    tests: ['backend/services/agent/src/agents/code-files.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/agents/code-files.ts#codeFileSchema',
    status: 'verified',
    summary: 'The rules for one code file.',
    why: "The name must be a safe relative path: plain letters, digits, '.', '_' and '-' in each part, no leading slash, no '..', at most 200 characters. The language is at most 40 characters and the content at most MAX_FILE_CHARS.",
    returns: 'A Zod object schema.',
    tests: ['backend/services/agent/src/agents/code-files.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/agents/code-files.ts#MAX_FILES',
    status: 'verified',
    summary: 'The most files a code answer keeps: 10.',
    why: 'The prompt asks for at most 10, and parseCodeFiles keeps no more.',
    returns: 'The number 10.',
    tests: ['backend/services/agent/src/agents/code-files.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/agents/code-files.ts#MAX_FILE_CHARS',
    status: 'verified',
    summary: 'The longest file a code answer keeps: 200,000 characters.',
    why: 'It keeps one runaway file from filling the answer; chat accepts up to 400,000 characters of answer text and 2 MB per request.',
    returns: 'The number 200000.',
    tests: ['backend/services/agent/src/agents/code-files.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/stops.ts#createStopSignals',
    status: 'verified',
    summary: 'Stopping an answer, whichever agent instance is writing it.',
    how: [
      'register puts the running answer in a local map with its abort controller and writes turn:<turn ID> with the owner for 15 minutes; the function it returns removes both.',
      'stop reads turn:<turn ID>: when it is missing or names another user it returns false; otherwise it publishes the turn ID on the turn-stops channel.',
      'Every instance subscribes to turn-stops with its own Redis connection (one in subscriber mode can run no other command), and the instance that has the turn aborts it.',
      'close clears the map and closes the subscriber.',
    ],
    why: 'The stop request can reach any agent instance, not necessarily the one writing the answer; Redis carries it to the right one, with the owner checked first.',
    returns: 'A promise of StopSignals with register, stop and close.',
    sideEffects: [
      'Opens a second Redis connection and subscribes to turn-stops.',
      'Writes and deletes turn:<turn ID> keys, and publishes stops.',
    ],
    tests: ['backend/services/agent/src/stops.test.ts', AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/telemetry.ts#LlmCallModel',
    status: 'verified',
    summary:
      "The Mongoose model for llmCalls: one record per model attempt, in the agent's database (gilder_agent).",
    how: [
      'Each record has the request ID, user, answer ID and agent (when known), the purpose, provider (one of PROVIDER_NAMES) and model, tokens in and out, time to the first token, latency, and a status of ok, error or stopped with the error message.',
      "Only createdAt is kept; an index on { userId, createdAt } lists one user's calls, newest first.",
    ],
    why: 'Every attempt is kept, a failed one before a fallback included, so cost and speed can be seen per model.',
    returns: 'A Mongoose model of LlmCall documents.',
    tests: ['backend/services/agent/src/telemetry.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/telemetry.ts#llmCallRecorder',
    status: 'verified',
    summary: "createLlm's onCall hook: saves each attempt with the request's user and ID.",
    why: "It reads the request context for the user and request ID, and saves the record without waiting; a failed save only logs the warning 'could not save an AI call record'. Telemetry must never slow down or break an answer.",
    returns: 'A function from an LlmCallRecord to nothing.',
    sideEffects: ['Writes an llmCalls document in MongoDB.'],
    tests: ['backend/services/agent/src/telemetry.test.ts'],
  },

  // -------------------------------------------------------------------------------------------
  // backend/services/agent/src/llm: the AI provider layer

  {
    symbol: 'backend/services/agent/src/llm/llm.ts#createLlm',
    status: 'verified',
    summary: 'The one way the agents call a model, with a fallback before the first token.',
    how: [
      'In mock mode every call goes to the mock provider. In live mode it takes the models for the purpose from MODEL_ROUTES and keeps those whose provider has a key; none left is a 503 service_unavailable.',
      'It streams from the first model, and sends a model event (provider and model) before its first token.',
      "If that model fails before its first token with a retryable error, and the caller has not stopped, it logs the warning 'model failed before answering; trying the next one' and tries the next. Otherwise the error goes up.",
      'complete streams to the end and returns the whole text, the model and the token counts, for short calls such as routing and titles.',
      "After every attempt it calls onCall with an LlmCallRecord: the purpose, the agent and answer ID from the call's tags, the provider and model, the tokens, the time to the first token, the latency, and a status of ok, error (with its message) or stopped (the caller aborted or stopped reading). index.ts passes llmCallRecorder, which saves it.",
    ],
    why: 'Once text has reached the user, switching models would mix two answers, so a fallback only happens before the first token. A stop or a bad request never moves on to another model. Recording every attempt, the failed ones included, shows what each answer really cost.',
    returns: 'An Llm with stream and complete.',
    tests: [AGENT_LLM_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/models.ts#MODEL_ROUTES',
    status: 'verified',
    summary: 'Which models answer each kind of call, first choice first.',
    how: [
      'router and title: Groq openai/gpt-oss-20b, low reasoning.',
      'chat and write: Groq openai/gpt-oss-120b, then openai/gpt-oss-20b.',
      'code: OpenRouter deepseek/deepseek-chat, then Groq openai/gpt-oss-120b.',
      'vision: Gemini gemini-3.5-flash, then gemini-3.8-flash, then gemini-flash-latest, each with low reasoning (Google retired gemini-2.5-flash for new keys).',
    ],
    why: "Models are changed in this one place. The chat agent uses chat, the router router, titles and the search agent's query rewrite title, the search and PDF question agents and the outlines of files write, the code agent code (OpenRouter first when its key is set), and the image question agent vision.",
    returns: 'A read-only map from purpose to a list of { provider, model, reasoningEffort? }.',
    tests: [AGENT_LLM_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/providers.ts#buildProviders',
    status: 'verified',
    summary: 'The providers that have keys, plus the mock one.',
    why: 'Groq, OpenRouter and Gemini each get an OpenAI-compatible client with their base URL when their key is set; OpenRouter also gets an x-title header naming the app. The mock needs no key. createLlm then only uses models whose provider is here.',
    returns: 'A map from provider name to provider.',
  },
  {
    symbol: 'backend/services/agent/src/llm/openai-compatible.ts#createOpenAiCompatibleProvider',
    status: 'verified',
    summary:
      'A streaming client for the OpenAI chat-completions API that Groq, OpenRouter and Gemini all offer.',
    how: [
      'It posts to <base URL>/chat/completions with the API key, stream: true and usage reporting, plus JSON mode, a token limit, a temperature or a reasoning effort when asked.',
      'It gives up if the response has not started within 20 seconds, or if a started answer goes silent for 30.',
      'A failed status is an LlmError, retryable for 408, 409, 429, 500, 502, 503 and 504, not for others such as 400 or 401.',
      "It yields each piece of answer text (a reasoning model's thinking is skipped) and the token usage once at the end.",
      'A stop from the caller is passed on as an abort, not as a provider failure.',
    ],
    why: 'One fetch-based client covers three providers with no SDKs, and its timeouts mean a stuck provider cannot hold an answer forever.',
    returns: 'An LlmProvider.',
    sideEffects: ["Calls the provider's API over HTTPS."],
    tests: [AGENT_OPENAI_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/sse.ts#readSseData',
    status: 'verified',
    summary: "Reads a server-sent events body and yields each event's data.",
    why: 'Providers stream their answer as server-sent events. It handles events split across reads, CRLF line ends and multi-line data, and calls onIdle (which aborts the call) when no bytes arrive for too long.',
    returns: 'An async generator of strings.',
    tests: [AGENT_SSE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/types.ts#LlmError',
    status: 'verified',
    summary: 'Why a provider call failed, and whether another model may be tried.',
    why: 'createLlm moves on to the next model only for a retryable LlmError: a rate limit, a server error, a timeout or a network failure. A bad request or a bad key would fail on the next model too.',
    tests: [AGENT_OPENAI_TEST, AGENT_LLM_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/types.ts#PROVIDER_NAMES',
    status: 'verified',
    summary: "The providers the model layer knows: 'groq', 'openrouter', 'gemini' and 'mock'.",
    why: 'The ProviderName type comes from it, and the llmCalls model limits its provider field to these names.',
    returns: 'A read-only array of four names.',
    tests: ['backend/services/agent/src/telemetry.test.ts'],
  },
  {
    symbol: 'backend/services/agent/src/llm/types.ts#LlmError.constructor',
    status: 'verified',
    summary: 'Builds the error with its provider, retryable flag, status and cause.',
    why: 'The provider and status end up in the logs when a model fails.',
    tests: [AGENT_OPENAI_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/mock.ts#createMockProvider',
    status: 'verified',
    summary: 'A provider that streams canned answers, so the app runs with no AI keys.',
    why: 'LLM_MODE=mock, the default, uses it in development, tests and CI. It behaves like a real provider: word by word (15 ms apart by default), with token usage estimated at four characters a token, and it stops when the caller aborts.',
    returns: 'An LlmProvider named mock.',
    tests: [AGENT_MOCK_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/mock.ts#defaultMockAnswer',
    status: 'verified',
    summary:
      "The mock's answer: a route to chat for JSON requests, otherwise an echo of the question.",
    why: 'Routing in mock mode always lands on chat (confidence 0.9), and an answer says plainly that it is a mock.',
    returns: 'A string.',
    tests: [AGENT_MOCK_TEST],
  },

  // -------------------------------------------------------------------------------------------
  // backend/services/agent: uploads, files and PDF indexing

  {
    symbol: 'backend/services/agent/src/files/file-checks.ts#UPLOAD_TYPES',
    status: 'verified',
    summary: 'What may be uploaded: PDFs up to 20 MB, and PNG, JPEG or WebP images up to 10 MB.',
    how: [
      'Each type maps to its purpose (pdf or image), its size limit and the extension a display name gets.',
    ],
    why: "One table drives the start check, the signed form's size range and the file name, so they cannot disagree.",
    returns: 'A read-only object keyed by MIME type.',
    tests: [AGENT_FILE_CHECKS_TEST, AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/file-checks.ts#MAX_PDF_PAGES',
    status: 'verified',
    summary: 'The most pages an uploaded PDF may have: 200.',
    why: 'Completing an upload refuses a longer PDF before anything tries to index it, which keeps indexing time and embedding calls bounded.',
    returns: '200',
  },
  {
    symbol: 'backend/services/agent/src/files/file-checks.ts#isUploadType',
    status: 'verified',
    summary: 'True when a MIME type is one of UPLOAD_TYPES.',
    why: 'It narrows the type for TypeScript, so the size limit and signature check can be looked up safely.',
    returns: 'true or false.',
    tests: [AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/file-checks.ts#matchesSignature',
    status: 'verified',
    summary: 'True when the first bytes are what files of this type always start with.',
    how: [
      'A PDF starts with %PDF-; a PNG with its 8-byte signature (89 50 4E 47 0D 0A 1A 0A); a JPEG with FF D8 FF; a WebP with RIFF, and WEBP at byte 8.',
    ],
    why: 'The type a browser claims is only a label. Checking the bytes means a renamed file cannot pass as a PDF or an image (SEC-07).',
    returns: 'true or false.',
    tests: [AGENT_FILE_CHECKS_TEST, AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/file-checks.ts#displayName',
    status: 'verified',
    summary: 'A file name that is safe wherever it is shown or downloaded.',
    how: [
      'It drops control characters, keeps only the part after the last slash or backslash, removes the characters " < > | * ? :, the extension and any leading dots, trims it and cuts it to 120 characters.',
      "Then it adds the type's own extension, so a PDF always ends in .pdf; an empty result becomes 'file'.",
    ],
    why: 'The name is shown in the app and used as the download name, but it never reaches a storage key.',
    returns: "A name such as 'trip.pdf'.",
    tests: [AGENT_FILE_CHECKS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/file-checks.ts#storageKey',
    status: 'verified',
    summary:
      'The storage key of a file, built from IDs only: users/<user ID>/uploads/<file ID>, or users/<user ID>/generated/<file ID>.',
    why: "A file name can never choose or change where a file is stored, so a name like ../../other-user cannot reach another user's files (SEC-07).",
    returns: "A key such as 'users/<user ID>/uploads/<file ID>'.",
    tests: [AGENT_FILE_CHECKS_TEST, AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/file-store.ts#createS3FileStore',
    status: 'verified',
    summary: 'The file store on an S3 bucket, with the AWS SDK.',
    how: [
      'uploadForm signs a presigned POST for one key, with Content-Type fixed to the given type and a content-length-range from 1 byte to the limit, valid for 5 minutes.',
      'head returns the size and type, or null when nothing is there; read returns the bytes, or only the first ones with a Range request; put stores bytes.',
      'downloadUrl signs a GET link, valid for 5 minutes, that saves the file under its name (with quotes and line breaks replaced).',
      'remove deletes many keys in one DeleteObjects call.',
    ],
    why: "A presigned POST lets S3 itself enforce the size range and the type, which a presigned PUT link cannot do for a range. Nothing in the bucket is public: every link is signed and short-lived. index.ts makes it only when all four S3 settings are set. No test calls a real bucket: the routes are tested against createMemoryFileStore, and a live run needs a bucket the agent's key can use.",
    returns: 'A FileStore.',
    sideEffects: ['Calls S3: signs, reads, writes and deletes objects.'],
  },
  {
    symbol: 'backend/services/agent/src/files/file-store.ts#createMemoryFileStore',
    status: 'verified',
    summary: 'A bucket in memory, for tests.',
    how: [
      'Objects live in a Map. simulateUpload stands in for the client posting the form; the form and the download links are made-up URLs that carry the key, the type and the limit.',
    ],
    why: 'The upload checks, indexing and clean-up can be tested end to end without AWS.',
    returns: 'A FileStore with its objects and simulateUpload.',
    tests: [AGENT_FILE_ROUTES_TEST, AGENT_INDEXER_TEST, AGENT_CLEANUP_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/models.ts#FileModel',
    status: 'verified',
    summary: "The agent's files, in gilder_agent.",
    how: [
      'Each file has its owner and chat, a kind (upload, or generated for the files agents make), a purpose (pdf, image or slides), a display name, its storage key, type and size, a status (pending, ready or failed) and, for a PDF, its page count.',
      "An index on userId, chatId and createdAt serves a chat's files.",
    ],
    why: 'Files are reached only by their ID and their owner, and links are signed on request, never stored.',
    tests: [AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/models.ts#DocumentModel',
    status: 'verified',
    summary: 'An uploaded PDF being made searchable, with its indexing status.',
    how: [
      'One per file (a unique fileId), with the owner, chat, page count, status (indexing, ready or failed) and the reason when it failed.',
    ],
    why: "GET /files/:fileId reports its status, and every piece in the vector store carries this document's ID.",
    tests: [AGENT_FILE_ROUTES_TEST, AGENT_INDEXER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/models.ts#toFile',
    status: 'verified',
    summary: 'What the API shows of a file.',
    how: ['ID, chat, kind, purpose, name, type, size, status and page count.'],
    why: 'The storage key and the owner stay inside the agent; download links are made fresh on request.',
    returns: 'A FileView.',
    tests: [AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/models.ts#findOwnedFile',
    status: 'verified',
    summary: 'The file with this ID if it belongs to the user, or null.',
    how: [
      'An ID that is not a valid ObjectId is null at once; otherwise it reads the file by its ID and owner.',
    ],
    why: "Another user's file and a missing one look the same, so file IDs cannot be probed.",
    returns: 'The file, or null.',
    tests: [AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/file-routes.ts#countPdfPages',
    status: 'verified',
    summary: "A PDF's page count, read with unpdf.",
    why: 'Completing an upload refuses an unreadable PDF, or one over MAX_PDF_PAGES, before it is indexed.',
    returns: 'The number of pages. It throws for a file that is not a readable PDF.',
    tests: [AGENT_FILE_ROUTES_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/file-routes.ts#fileRouter',
    status: 'verified',
    summary:
      "Uploads in two calls around the client's own upload to S3, a file's details, and fresh download links.",
    how: [
      "POST /files/uploads takes a strict { chatId, name, mime, sizeBytes }. It refuses another type (415) or a size over the type's limit (413), checks the chat with chat, records the file as pending with a cleaned name and an ID-only key, and answers 201 with the file and a signed upload form.",
      "POST /files/:fileId/complete reads the owner's upload (404 otherwise). A ready file is returned as it is; a failed one is a 409, and so is an upload that has not arrived. The stored type must be the announced one, the size within the limit and the first 16 bytes the type's signature; a PDF must open and have at most 200 pages. A file that fails is deleted and marked failed (415). One that passes is marked ready; a PDF also gets a document and is handed to onPdfReady.",
      'GET /files/:fileId answers the file and, for a PDF, its indexing status.',
      'GET /files/:fileId/url answers a download link for a ready file, valid for 300 seconds.',
      "Without a file store, every route that needs one answers 503 'File uploads are not set up on this server'.",
    ],
    why: "The client's claims are only a first filter: what counts is what arrived in the bucket. Links are signed on request and expire in minutes, so no stored link ever goes stale.",
    returns: 'An Express Router.',
    sideEffects: [
      'Creates and updates files and documents in MongoDB; reads and deletes objects in storage.',
    ],
    tests: [AGENT_FILE_ROUTES_TEST, GATEWAY_ROUTE_TABLE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/test-pdf.ts#makePdf',
    status: 'verified',
    summary: 'Builds a small, valid PDF with one line of text per page, for tests.',
    how: [
      'It writes the catalog, the page tree, a Helvetica font, and a page and content stream per line, then a correct cross-reference table.',
    ],
    why: 'The upload and indexing tests need real PDFs that unpdf can open, count and read, without binary files in the repo.',
    returns: 'The PDF as a Buffer.',
    tests: [AGENT_FILE_ROUTES_TEST, AGENT_INDEXER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/rag/chunks.ts#chunkPages',
    status: 'verified',
    summary: "Splits a PDF's text into overlapping pieces, page by page.",
    how: [
      'Each page has its whitespace collapsed, then is cut into pieces of up to 1,000 characters (CHUNK_CHARS).',
      'A piece ends at the last space before the limit when that space is in its second half, so words are not cut.',
      'The next piece starts 200 characters (CHUNK_OVERLAP) before the last one ended, and always moves forward.',
      'Every piece keeps its page number; empty pieces are dropped.',
    ],
    why: "Pieces never cross a page, so each one can be cited by its page. The overlap keeps a sentence cut at one piece's end whole in the next.",
    returns: 'A list of { page, text }.',
    tests: [AGENT_CHUNKS_TEST, AGENT_INDEXER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/rag/embeddings.ts#EMBEDDING_DIMENSIONS',
    status: 'verified',
    summary: 'The size of every vector: 768 numbers.',
    why: 'Gemini is asked for 768 numbers, the stand-in makes 768, and the Qdrant collection is created for 768, so they always fit together.',
    returns: '768',
  },
  {
    symbol: 'backend/services/agent/src/rag/embeddings.ts#createGeminiEmbedder',
    status: 'verified',
    summary: "Turns text into vectors with Gemini's embedding model, over its REST API.",
    how: [
      "Texts go 100 at a time to gemini-embedding-001's batchEmbedContents, with the key in x-goog-api-key.",
      'Each text is embedded for its role, RETRIEVAL_DOCUMENT for PDF pieces and RETRIEVAL_QUERY for questions, as 768 numbers.',
      "Each call has a 30-second limit, combined with the caller's abort signal. A failed call is a 503; an aborted one passes the abort on.",
    ],
    why: 'fetch is enough, so there is no Google SDK. Embedding documents and questions with their own task types gives better matches. index.ts uses it when LLM_MODE is live and GEMINI_API_KEY is set, and a live check with a local Qdrant ranked the right page first. No test calls it.',
    returns: 'An Embedder.',
    sideEffects: ["Calls Gemini's API over HTTPS."],
  },
  {
    symbol: 'backend/services/agent/src/rag/embeddings.ts#mockEmbedder',
    status: 'verified',
    summary: 'A stand-in embedder: the same text always gives the same vector.',
    how: [
      'Each word is hashed to one of the 768 places, which counts it; the vector is then scaled to length 1.',
    ],
    why: 'Mock mode and the tests can index and search without a key, and texts that share words still come out close.',
    returns: '768-number vectors.',
    tests: [AGENT_INDEXER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/rag/vector-store.ts#createQdrantStore',
    status: 'verified',
    summary: 'The vector store on Qdrant, over its REST API with fetch.',
    how: [
      'ensureReady creates the document_chunks collection the first time (768 dimensions, cosine distance), with keyword indexes on userId, documentId and chatId.',
      'upsert writes points 256 at a time, each with a random ID, its vector and its payload (owner, document, chat, page and text), and waits until they are stored.',
      'search and removeDocuments always filter by the owner and a list of document IDs.',
      'Every call has a 15-second limit; no answer, or an error status, is a 503.',
    ],
    why: "Every query carries the owner filter, so one user's documents can never answer another user's question. fetch is enough, so there is no Qdrant SDK. index.ts uses it when QDRANT_URL is set, and a live check with real Gemini embeddings ranked the right page first. No test calls a real Qdrant.",
    returns: 'A VectorStore.',
    sideEffects: [
      'Calls Qdrant over HTTP: creates the collection, and writes, searches and deletes points.',
    ],
  },
  {
    symbol: 'backend/services/agent/src/rag/vector-store.ts#createMemoryVectorStore',
    status: 'verified',
    summary: 'Qdrant in memory, for tests and when QDRANT_URL is not set.',
    how: [
      'Points live in an array. search ranks the points of the given owner and documents by cosine similarity; removeDocuments deletes them.',
    ],
    why: 'Indexing, search and clean-up run in tests with the same owner filter as the real store.',
    returns: 'A VectorStore with its points.',
    tests: [AGENT_INDEXER_TEST, AGENT_CLEANUP_TEST],
  },
  {
    symbol: 'backend/services/agent/src/rag/indexer.ts#extractPages',
    status: 'verified',
    summary: "A PDF's text, one string per page, read with unpdf.",
    why: 'Keeping the pages apart lets every piece keep its page number.',
    returns: 'A list of page texts.',
    tests: [AGENT_INDEXER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/rag/indexer.ts#indexPdf',
    status: 'verified',
    summary: 'Makes an uploaded PDF searchable, then marks its document ready or failed.',
    how: [
      "It finds the file's document; without one it stops.",
      'It reads the file, extracts its text per page (extractPages) and cuts it into pieces (chunkPages). A PDF with no text at all fails with a message that it may be scanned images.',
      'It embeds the pieces as documents, makes sure the collection exists and stores every piece with its owner, document, chat, page and text.',
      "The document is saved as ready, and 'PDF indexed' is logged with the number of pieces. Any failure saves it as failed with the first 300 characters of the reason, and logs 'PDF indexing failed' at warn.",
    ],
    why: 'It runs after the upload has answered, so a long PDF does not hold up the client, and it never throws: the outcome is always on the document. The tests index a real PDF, check that the right page comes first for a question, and that another user finds nothing.',
    sideEffects: [
      'Reads the file from storage, calls the embedder and writes to the vector store; updates the document in MongoDB; writes a log line.',
    ],
    tests: [AGENT_INDEXER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/rag/cleanup.ts#cleanUpDeletedChats',
    status: 'verified',
    summary: 'Removes the files, documents and indexed pieces of chats that are gone.',
    how: [
      'It groups the chat IDs of all files by user.',
      'For each user, up to 200 chat IDs at a time, it asks chat which are gone (deletedChats).',
      "For those chats it deletes the documents' pieces from the vector store, the objects from storage (when there is a store), then the document and file records.",
    ],
    why: 'Files belong to their chat. Chat never calls the agent when a chat is deleted; the agent asks instead, so a delete stays one quick update in chat and nothing is missed if the agent was down.',
    returns: 'How many files it removed.',
    sideEffects: ['Deletes points, objects, documents and files.'],
    tests: [AGENT_CLEANUP_TEST],
  },
  {
    symbol: 'backend/services/agent/src/rag/cleanup.ts#startFileCleanup',
    status: 'verified',
    summary: 'Runs cleanUpDeletedChats every ten minutes, never two at once.',
    how: [
      "A run is skipped while the last one is still going. A run that removed files logs it at info; a failed one logs 'file clean-up failed; it runs again shortly' at error.",
      'The timer is unref-ed, so it never keeps the process alive.',
    ],
    why: 'Clean-up is safe to repeat, so a plain timer is enough. index.ts starts it at startup and stops it first on shutdown.',
    returns: 'A function that stops it.',
  },

  // -------------------------------------------------------------------------------------------
  // backend/services/agent: questions about files, and making files

  {
    symbol: 'backend/services/agent/src/llm/types.ts#LlmContentPart',
    status: 'verified',
    summary: 'A piece of a message: text, or an image as a data URL.',
    why: 'A message is plain text, or a list of these parts when a model that can see gets an image. The parts follow the OpenAI chat format, so the same provider client sends them to Gemini unchanged.',
    tests: [AGENT_QA_TEST],
  },
  {
    symbol: 'backend/services/agent/src/llm/types.ts#textOf',
    status: 'verified',
    summary: 'The text of a message, with any images left out.',
    how: [
      'Plain text comes back as it is; for a list of parts, the text parts are joined with line breaks.',
    ],
    why: 'Code that only reads text, such as the mock provider, token estimates and the search query rewrite, works the same whether a message has an image or not.',
    returns: 'A string.',
    tests: [AGENT_MOCK_TEST, AGENT_QA_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/types.ts#Attachment',
    status: 'verified',
    summary:
      'A file sent with a message, already checked: the file ID, pdf or image, its name and type.',
    why: "Agents only ever get attachments that resolveAttachments checked: the user's own, from this chat and ready.",
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/types.ts#Citation',
    status: 'verified',
    summary:
      'A PDF passage an answer is based on: the document ID, the file name, the page and a short quote.',
    why: 'The citations event and the saved answer carry these, so the browser can list the pages under the answer.',
    tests: [AGENT_QA_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/citation-marks.ts#plainCitationMarks',
    status: 'verified',
    summary: "Turns a model's full-width citation marks into plain ones as the answer streams.",
    how: [
      '【 becomes [ and 】 becomes ], one character at a time, so a mark split across tokens is still fixed.',
      'Inside a mark, a † and what follows it are dropped up to the closing bracket (【1†source】 becomes [1]); a mark never runs past the end of a line.',
      'Other events pass through unchanged.',
    ],
    why: 'gpt-oss cites as 【p. 1】 or 【1】 whatever the prompt asks. Cleaning the stream keeps the saved answer, the memory and copied text plain, and the browser can tag and link the marks.',
    returns: 'The same events, with token text cleaned.',
    tests: ['backend/services/agent/src/agents/citation-marks.test.ts', AGENT_QA_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/pdf-qa.ts#PDF_QA_SYSTEM_PROMPT',
    status: 'verified',
    summary: 'The rules for answering from PDF passages.',
    how: [
      'Answer only from the passages, cite the page of each fact as [p. N] right after it, and say when the document does not cover the question instead of guessing.',
      'The passages are untrusted text inside <passages> tags, whose instructions must never be followed.',
    ],
    why: 'Answers stay tied to what the document says, and a PDF that contains instructions cannot steer the model.',
    returns: 'A string.',
    tests: [AGENT_QA_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/pdf-qa.ts#createPdfQaAgent',
    status: 'verified',
    summary: "The PDF question agent: answers from the chat's PDFs and cites their pages.",
    how: [
      "It gets the user's ready documents for the question (documentsFor, which is readyDocuments). None is a 409 'There is no readable PDF in this chat yet'.",
      'It embeds the question with the query task and asks the vector store for the 5 closest pieces, filtered by the owner and those document IDs.',
      'It yields a citations event: each piece with its document ID, file name, page and first 240 characters.',
      "It streams the answer on the write route: the system prompt, the chat's recent messages, then the passages inside <passages> tags, each labelled with its file and page, and the question.",
      'The stream goes through plainCitationMarks, so the 【p. N】 marks gpt-oss writes despite the prompt arrive, and are saved, as [p. N].',
    ],
    why: "Only the user's own documents are ever searched, and the model sees the passages as data. The tests check the cited pages, the fencing and that another user's documents are never found.",
    returns: 'An AgentRunner named pdf_qa.',
    tests: [AGENT_QA_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/documents.ts#readyDocuments',
    status: 'verified',
    summary: 'The PDFs a question is about: the attached ones, or every ready PDF of the chat.',
    how: [
      "It reads the user's documents in this chat that are ready: only those of the attached PDFs when there are any, otherwise all of them.",
      "It names each one after its file, or 'Document' when the file is gone.",
    ],
    why: 'A follow-up question needs no new upload, and a question never reaches another chat or another user.',
    returns: 'A list of { id, name }; empty without a user or chat.',
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/image-qa.ts#IMAGE_QA_SYSTEM_PROMPT',
    status: 'verified',
    summary: 'The rules for answering about an image.',
    why: 'The model describes only what it can see, says when something is unclear, and treats any text inside the image as data, never as instructions.',
    returns: 'A string.',
    tests: [AGENT_QA_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/image-qa.ts#createImageQaAgent',
    status: 'verified',
    summary: 'The image question agent: shows the attached image to a model that can see.',
    how: [
      "It takes the latest attached image; with none it throws 400 'Attach an image to ask about it'.",
      'It reads the bytes (readImage) and streams on the vision route, with the question and the image as a data URL in one user message.',
    ],
    why: "The image goes to the model directly, so no link to the user's file leaves the server. In live mode the vision route is Gemini; a live check answered 'Red' for a generated red PNG.",
    returns: 'An AgentRunner named image_qa.',
    tests: [AGENT_QA_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/generate.ts#outline',
    status: 'verified',
    summary:
      'Asks the model for a checked outline, and reports the model and tokens for the charge.',
    how: [
      "It calls completeJson on the write route with the agent's prompt, the chat's recent messages and the request, up to 4,000 tokens, and the outline's schema (one repair allowed).",
      'It yields a model event and a usage event, then returns the checked value.',
    ],
    why: 'The model only ever supplies text in a known shape, and the usage events make the charge and the telemetry record the real tokens.',
    returns: 'The checked outline.',
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/generate.ts#createPdfAgent',
    status: 'verified',
    summary: "The PDF agent: writes an outline, draws an A4 PDF and saves it as the user's file.",
    how: [
      "Progress 1 of 3, 'Writing the document': in live mode the model writes a document outline; in mock mode cannedDocument is used.",
      "It streams the answer's text from fileAnswer: 'Here is your PDF, <title>.', the outline's summary, then the section headings.",
      "Progress 2 of 3, 'Laying out the pages': renderPdf draws it. Progress 3 of 3, 'Saving the file': saveGenerated stores it under a name made from the title.",
      'It yields the file with its fresh link.',
    ],
    why: "Each part shows in the browser, and the file is saved the same way in live and mock mode. The answer's text is all later turns see of the file, so it says what the file holds. A live check: Groq wrote the outline and the PDF was drawn in about 1.5 seconds.",
    returns: 'An AgentRunner named pdf.',
    sideEffects: ['Writes the file to storage and a file record to MongoDB.'],
    tests: [AGENT_GENERATE_TEST, AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/generate.ts#createSlidesAgent',
    status: 'verified',
    summary: 'The slides agent: writes a deck outline, draws a PowerPoint file and saves it.',
    how: [
      "The same three parts as the PDF agent ('Writing the slides', 'Designing the deck', 'Saving the file'), with a deck outline (cannedDeck in mock mode) and renderSlides.",
      'The answer (fileAnswer) says how many slides the deck has, the title slide included, then gives the subtitle and the slide titles.',
    ],
    why: 'A deck the user can open and edit, made from checked text.',
    returns: 'An AgentRunner named slides.',
    sideEffects: ['Writes the file to storage and a file record to MongoDB.'],
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/generate.ts#createImageAgent',
    status: 'verified',
    summary: 'The image agent: writes an image prompt, draws the image and saves it.',
    how: [
      "Progress 1 of 3, 'Writing the prompt': in live mode the model writes { prompt, title }, told never to add text, logos or real people the user did not ask for; in mock mode cannedImagePrompt uses the request.",
      "Progress 2 of 3, 'Drawing the image': drawImage (Pollinations in live mode, a one-colour PNG in mock mode). Progress 3 of 3, 'Saving the image'.",
      'It yields the file with its fresh link, named .jpg or .png to match. The answer gives the title and the prompt the image was drawn from.',
    ],
    why: 'The prompt is written for the image service from the conversation, and the rest of the flow is the same as for documents.',
    returns: 'An AgentRunner named image.',
    sideEffects: [
      'Calls the image service; writes the file to storage and a file record to MongoDB.',
    ],
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/generate.ts#FACTS_RULE',
    status: 'verified',
    summary: 'The rule in the document and deck prompts against made-up facts.',
    how: [
      'Use only facts from the conversation or well-established public knowledge, and never invent any.',
      'For a private person, or anything without reliable facts, never make up a career, education, contact details, dates or figures: write a fill-in template with placeholders in square brackets, like [Your education]. The summary (a deck: the subtitle) then says it is a template.',
    ],
    why: "A made file looks authoritative. Before this rule, 'give me a PDF of <a name>' got a profile the model wrote from nothing.",
    returns: 'A string, added to the PDF and slides prompts.',
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/generate.ts#fileAnswer',
    status: 'verified',
    summary: 'The answer that comes with a made file: which file, what it covers and its parts.',
    how: [
      "The lead ('Here is your PDF, <title>.'), then the summary as a sentence, then a line such as 'Sections: A · B · C' when there are parts. Dots, not commas and 'and', because a heading can have 'and' in it.",
    ],
    why: 'It is saved as the answer, and the chat memory holds only answer text, so it is how later turns know what the file holds.',
    returns: 'The answer text.',
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/agents/generate.ts#cannedDocument',
    status: 'verified',
    summary:
      'The document outline used in mock mode: a short title from the request and two sections.',
    why: 'Files can be made, saved and downloaded with no AI keys, in development and tests. cannedDeck and cannedImagePrompt do the same for decks and images.',
    returns: 'A DocumentOutline.',
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/generate/outlines.ts#documentOutline',
    status: 'verified',
    summary: 'The shape a document outline must have before it is drawn.',
    how: [
      'A title (up to 120 characters), an optional summary (400), and 1 to 12 sections, each with a heading, up to 8 paragraphs of up to 2,000 characters and up to 12 bullets of up to 600.',
      'Every string is trimmed; missing lists become empty.',
    ],
    why: 'The model supplies only plain text in a known shape, never markup, so nothing but text can end up in the file, and a runaway reply cannot make a huge one.',
    returns: 'A Zod schema.',
    tests: [AGENT_GENERATE_TEST, AGENT_RENDER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/generate/outlines.ts#deckOutline',
    status: 'verified',
    summary: 'The shape a deck outline must have: a title, a subtitle and 1 to 15 slides.',
    how: [
      'Each slide has a title, up to 7 bullets of up to 600 characters, and notes of up to 1,000.',
    ],
    why: 'As for documents: only checked text, with limits, reaches the drawing code.',
    returns: 'A Zod schema.',
    tests: [AGENT_RENDER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/generate/outlines.ts#imagePrompt',
    status: 'verified',
    summary: 'The shape of an image request: a prompt of 3 to 600 characters and a short title.',
    why: 'The title becomes the file name and the alt text, so it is kept short.',
    returns: 'A Zod schema.',
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/generate/render.ts#renderPdf',
    status: 'verified',
    summary: 'Draws a document outline as a simple A4 PDF, with pdfkit.',
    how: [
      'The title in bold at 22 points, the summary in grey, then each section: its heading in bold, its paragraphs and its bullets in Helvetica at 11 points, with 56-point margins.',
      "The PDF's metadata gives the title, and GilderAi as its creator.",
      'Every text goes through pdfText first.',
    ],
    why: 'A plain, readable layout that needs no fonts or templates of its own.',
    returns: 'A promise of the PDF bytes.',
    tests: [AGENT_RENDER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/generate/render.ts#pdfText',
    status: 'verified',
    summary: "Swaps the characters the PDF's built-in fonts can't draw for plain ones.",
    how: [
      'Non-breaking and other hyphens and the minus sign become -, thin and narrow no-break spaces a space, and zero-width characters nothing; → ← ⇒ ≥ ≤ become ->, <-, =>, >= and <=.',
    ],
    why: "pdfkit's built-in fonts draw only the Windows-1252 characters and silently drop the rest. gpt-oss writes non-breaking hyphens often, so 'fill‑in' printed as 'fill  in'.",
    returns: 'The text, ready to draw.',
    tests: [AGENT_RENDER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/generate/render.ts#renderSlides',
    status: 'verified',
    summary: 'Draws a deck outline as a 16:9 PowerPoint file, with pptxgenjs.',
    how: [
      'A title slide with the title and subtitle, then one slide per point with its title, its bullets and its speaker notes.',
    ],
    why: 'A file people can open and edit in PowerPoint, Keynote or Google Slides.',
    returns: 'A promise of the .pptx bytes.',
    tests: [AGENT_RENDER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/generate/render.ts#PptxGenJS',
    status: 'verified',
    summary: 'The pptxgenjs class, whichever way the package hands it over.',
    why: "Per its comment, the package's types put the class on a default property, while in Node the default import is the class itself; this accepts either, so the code runs under Node and type-checks.",
  },
  {
    symbol: 'backend/services/agent/src/generate/images.ts#pollinationsImage',
    status: 'verified',
    summary: 'Draws an image with Pollinations: one GET with the prompt in the path.',
    how: [
      'It asks for 1024×1024, with no logo and as private, using the first 500 characters of the prompt, and waits up to 90 seconds (or until the answer is stopped).',
      'No answer is a 503; so is an error status, a type other than JPEG or PNG, or a file over 8 MB.',
    ],
    why: 'Pollinations needs no key or account. A live check returned a 1024×1024 JPEG in about 10 seconds.',
    returns: 'A promise of { bytes, mime }.',
    sideEffects: ['Calls Pollinations over HTTPS.'],
  },
  {
    symbol: 'backend/services/agent/src/generate/images.ts#solidPng',
    status: 'verified',
    summary: 'A small one-colour PNG, its colour picked from the prompt.',
    how: [
      'It writes a valid PNG by hand: the signature, a header, the pixels compressed with deflate, and a CRC for each chunk.',
    ],
    why: 'Mock mode needs a real image to store and show, with no outside service. mockImage returns it.',
    returns: 'The PNG bytes (64×64 by default).',
    tests: [AGENT_RENDER_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/generated.ts#saveGenerated',
    status: 'verified',
    summary:
      "Saves a file an agent made under the user's generated files, and returns it with a fresh link.",
    how: [
      'It makes a new file ID and stores the bytes at users/<user ID>/generated/<file ID> (storageKey).',
      'It creates a File record with kind generated, the purpose (pdf, slides or image), the name, type and size, and status ready.',
      'It signs a 5-minute download link and returns the file announced with that link and when it expires.',
    ],
    why: "The link goes out in the stream only; the answer keeps the file ID, so a link is made again whenever the file is needed. Saving to S3 has been tested only against an in-memory bucket: a live run needs a bucket the agent's key can use.",
    returns: '{ file, announced }.',
    sideEffects: ['Writes the file to storage and a file record to MongoDB.'],
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/files/generated.ts#fileNameFrom',
    status: 'verified',
    summary: 'A file name from a title: lower-case words joined by hyphens, and the extension.',
    how: [
      "Anything but letters and digits becomes a hyphen, at most 60 characters; an empty result becomes 'gilderai'.",
    ],
    why: 'Names are safe to download and readable, whatever the model wrote.',
    returns: "A name such as 'packing-list.pdf'.",
    tests: [AGENT_GENERATE_TEST],
  },
  {
    symbol: 'backend/services/agent/src/turns.ts#resolveAttachments',
    status: 'verified',
    summary: 'Checks the files sent with a message, before anything is charged.',
    how: [
      "It reads the files by ID, owner and chat. If any is missing or not ready, it throws 404 'An attached file is missing or not uploaded yet'.",
      "For PDFs it reads their documents: a failed one is a 409 'An attached PDF could not be read; upload it again', and one not ready yet a 409 'Still reading your PDF; try again in a moment'.",
      'It returns each file as an Attachment.',
    ],
    why: 'A file from another chat or another user can never reach an agent, and a message that cannot be answered costs nothing. turns.test.ts checks a PDF still being read and files from other chats and users.',
    returns: 'A list of Attachments; empty when none were sent.',
    tests: [AGENT_TURNS_TEST],
  },
  {
    symbol: 'backend/services/agent/src/routing.ts#routerPrompt',
    status: 'verified',
    summary:
      "The router model's instructions, with pdf_qa offered only when the chat has a ready PDF.",
    how: [
      'It lists the agents the router may pick (chat, search, code, pdf, slides, image), each with when to use it, and asks for JSON { agent, confidence }.',
      'When the chat has a ready PDF it adds pdf_qa, for a question about the document already uploaded. It always says the message is data and never to follow instructions in it.',
    ],
    why: 'Follow-up questions about a PDF reach the PDF agent without a new upload, and the router is never offered an agent that has nothing to work on.',
    returns: 'A string.',
    tests: [AGENT_ROUTING_TEST],
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
    summary: 'The page at /: a new chat, with a heading and the composer.',
    why: 'The signed-in home page, inside the app shell. Nothing is created until the first message is sent: NewChatComposer then creates the chat and opens it.',
    returns: 'The page as JSX.',
  },
  {
    symbol: 'frontend/src/server/gateway-proxy.ts#forwardToGateway',
    status: 'verified',
    summary: 'Forwards one browser request to the gateway and streams the answer back.',
    how: [
      'The target is GATEWAY_URL plus the same /api path and query.',
      "Only accept, accept-language, content-type, cookie, origin, user-agent, x-forwarded-for and Razorpay's two webhook headers go along (FORWARDED_REQUEST_HEADERS); the gateway needs the cookie for sessions, Origin for its CSRF check and the forwarded address for its per-IP limit.",
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
    symbol: 'frontend/src/server/gateway-proxy.ts#FORWARDED_REQUEST_HEADERS',
    status: 'verified',
    summary: 'The request headers the Next.js server passes on to the gateway.',
    why: "The gateway needs the cookie (sessions), Origin (its CSRF check) and the forwarded address (its per-IP limit). Razorpay's webhook signs its body, so x-razorpay-signature and x-razorpay-event-id go along too; the gateway passes them on to billing for that route only.",
    returns:
      "['accept', 'accept-language', 'content-type', 'cookie', 'origin', 'user-agent', 'x-forwarded-for', 'x-razorpay-event-id', 'x-razorpay-signature']",
    tests: ['frontend/src/server/gateway-proxy.test.ts'],
  },
  {
    symbol: 'frontend/src/server/health.ts#siteHealth',
    status: 'verified',
    summary: "The site's health for uptime monitors: ok only when the gateway is ready.",
    how: [
      "It fetches the gateway's /readyz (which checks Redis), with no caching and a time limit of 3 seconds by default.",
      "A 2xx answer is { status: 'ok' } with 200. Anything else, a gateway that cannot be reached or one too slow, is { status: 'unavailable' } with 503. Both carry cache-control: no-store.",
    ],
    why: "One URL proves the whole path a visitor's request takes: the web server, the gateway and Redis, and through Caddy in production. The gateway's check details are never passed on, so the answer tells a visitor nothing about the setup.",
    returns: 'A promise of the Response.',
    tests: ['frontend/src/server/health.test.ts'],
  },
  {
    symbol: 'frontend/src/app/api/health/route.ts#GET',
    status: 'verified',
    summary: 'GET /api/health: 200 when the whole path to the backend works, otherwise 503.',
    how: [
      'await connection() makes it run on every request, so it is never prerendered.',
      'It calls siteHealth with GATEWAY_URL.',
    ],
    why: 'A static route segment wins over the /api/[...path] proxy route, so this request is answered by the web server itself and the gateway never sees it as an /api route. Checked against the production build behind Caddy: 200, then 503 with the gateway stopped, then 200 again.',
    returns: 'A promise of the Response.',
    tests: ['frontend/src/server/health.test.ts'],
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
      'For uploads, connect-src allows exactly one bucket (uploadsOrigin, from S3_BUCKET_ORIGIN), never any AWS address; with none configured the browser cannot reach S3 at all.',
      'upgrade-insecure-requests outside development.',
    ],
    why: "A nonce would force every page to render per request, which rules out the prerendered shells; the trade-off was reviewed and kept, since React's escaping, Markdown that shows raw HTML as text and the sandboxed code preview are the main defences. The policy never adds a hash or nonce, which would switch 'unsafe-inline' off and break Next.js's own scripts.",
    returns: 'The policy as one header value.',
    tests: ['frontend/src/server/security-headers.test.ts'],
  },
  {
    symbol: 'frontend/src/server/security-headers.ts#bucketOrigin',
    status: 'verified',
    summary: 'Checks the configured bucket address before it goes into the policy.',
    why: 'next.config.ts reads S3_BUCKET_ORIGIN when the app is built. Only one bare https origin is accepted (a trailing slash is dropped), and http, a path, a wildcard or a plain name fail the build, so a typo can never widen the policy. Empty means not set.',
    returns: 'The origin, or undefined when unset.',
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
    summary:
      'The right side of the sign-in page: the Google button, the terms line, a note on sessions and payments, and dev sign-in in development builds.',
    how: [
      'Google: a white button with a round "G" mark. The Firebase popup returns an ID token, which is posted to /api/auth/session. The button is disabled until the Firebase web config is set.',
      'Below it: links to /terms and /privacy, then a short note that the session lives on the server and card details go only to Razorpay.',
      'Dev sign-in: posts { email } to /api/auth/dev-session.',
      'On success it goes to /. A failure shows a toast with the request reference; closing the Google popup shows nothing.',
    ],
    why: 'One form for both ways in, so sessions start the same way whichever is used.',
    returns: 'The form as JSX.',
    tests: ['frontend/src/app/login/login-form.test.tsx'],
  },
  {
    symbol: 'frontend/src/app/login/page.tsx#LoginPage',
    status: 'verified',
    summary: 'The sign-in page: what the app does on the left, the sign-in form on the right.',
    how: [
      'Two panels that wrap: the brand panel (logo, headline, four features, footer) on a surface background, and the sign-in panel centred beside it.',
      'Below 960 px the panels stack. On phones the feature list and footer are hidden, so the Google button shows without scrolling.',
    ],
    why: 'The first screen people see says what the app is before asking them to sign in.',
    returns: 'The page as JSX.',
  },
  {
    symbol: 'frontend/src/components/app-shell/brand.tsx#Logo',
    status: 'verified',
    summary: 'The diamond mark in the accent colour, with a lighter right half.',
    why: 'Shared by the sign-in page, the legal pages and the sidebar, so the brand looks the same everywhere. It is aria-hidden because the name is always beside it.',
    returns: 'An SVG.',
  },
  {
    symbol: 'frontend/src/components/app-shell/brand.tsx#Wordmark',
    status: 'verified',
    summary: 'The name as the brand writes it: "Gilder", then "Ai" in the accent text colour.',
    why: 'One component for the name, so its look changes in one place.',
    returns: 'A span.',
  },
  {
    symbol: 'frontend/src/components/legal/legal-page.tsx#LegalPage',
    status: 'verified',
    summary:
      'The frame of the Terms and Privacy pages: a header with the brand and links to both pages, the title, the date and the sections.',
    why: 'Both pages are public (the sign-in gate covers only /, /c and /settings) and share one readable layout.',
    returns: 'The page frame as JSX.',
    tests: ['frontend/src/components/legal/legal-pages.test.tsx'],
  },
  {
    symbol: 'frontend/src/app/privacy/page.tsx#PrivacyPage',
    status: 'verified',
    summary:
      'The privacy policy in plain words: what is collected, why, which services handle it, cookies, how long it is kept, and how to get it deleted.',
    why: 'Linked from the sign-in page. It names every outside service the app sends data to (Firebase, the AI providers, Tavily, AWS, Razorpay), matching what the code does, and gives the contact address for data requests (ContactEmail, a mail link).',
    returns: 'The page as JSX.',
    tests: ['frontend/src/components/legal/legal-pages.test.tsx'],
  },
  {
    symbol: 'frontend/src/app/terms/page.tsx#TermsPage',
    status: 'verified',
    summary:
      'The terms of use in plain words: the service, accounts, credits and test-mode payments, fair use, AI answers, your content and limits.',
    why: 'Linked from the sign-in page, and needed before payments can go live.',
    returns: 'The page as JSX.',
    tests: ['frontend/src/components/legal/legal-pages.test.tsx'],
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
      'The page goes in <main>, which scrolls on its own and is focusable (tabIndex 0, with a focus ring), so keyboard users can scroll it even on a page with nothing else to focus.',
      "<main> is position: relative, so absolutely positioned content inside it (the screen-reader-only 'You said:' labels) stays in its own scroll area. Without that, those labels overflowed the page, the page itself became scrollable, and scrolling the conversation could slide the whole app up and leave an empty band below it.",
    ],
    why: 'Everything outside those boundaries is static, so the shell can be prerendered and the account streams in. The chat list loads later, in the browser.',
    returns: 'The layout as JSX.',
  },
  {
    symbol: 'frontend/src/components/app-shell/sidebar.tsx#SidebarFrame',
    status: 'verified',
    summary:
      'The sidebar on medium and larger screens: brand, New chat, Search chats, the chat list, the credits card and the account part.',
    why: 'New chat is a link to /, which creates nothing: an empty new chat. SearchButton opens the search dialog, and ChatList and CreditsCard load in the browser. The account part comes in as children, because it needs the session and sits in a Suspense boundary. Below the md breakpoint the sidebar is hidden and MobileBar takes over.',
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
      'It holds New chat, Search chats, the same ChatList as the sidebar and the credits card.',
      'A click on a link, or on an element marked data-closes-nav such as the search button, closes it.',
    ],
    why: 'Below the md breakpoint the sidebar is hidden, so the chats need another way in. Using the same ChatList means the same cached list.',
    returns: 'The menu button and the panel as JSX.',
  },
  {
    symbol: 'frontend/src/components/ui/avatar.tsx#Avatar',
    status: 'verified',
    summary: 'A round profile picture, with the initials while it loads or when there is none.',
    how: [
      'Radix loads the picture first and shows it only once it has loaded; until then, or if it fails, the initials of the first two words of the name show.',
      'The picture is requested with referrerPolicy no-referrer, and Radix uses the same policy for its preload.',
    ],
    why: 'Google refuses profile photos (lh3.googleusercontent.com) when the request says which site it comes from, so with the default policy every Google user saw only initials. Not sending the site is also more private.',
    returns: 'The avatar as JSX.',
    tests: ['frontend/src/components/ui/controls.test.tsx'],
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

  {
    symbol: 'frontend/src/components/app-shell/account-menu.tsx#AccountMenu',
    status: 'verified',
    summary:
      'The account button: who is signed in, the theme, Billing and credits, Usage, and sign out.',
    how: [
      'The button shows the avatar and the name (with the email under it), or only the avatar in the small-screen top bar.',
      'The theme items (System, Light, Dark) save the choice and mark the current one.',
      "'Billing and credits' opens /settings/billing and 'Usage' opens /settings/usage.",
      "Sign out ends the session and goes to the sign-in page, also when the session had already ended (a 401); any other failure shows 'Could not sign out'.",
    ],
    why: 'Everything about the account sits behind one button at the bottom of the sidebar.',
    returns: 'The menu as JSX.',
    tests: ['frontend/src/components/app-shell/account-menu.test.tsx'],
  },

  // -------------------------------------------------------------------------------------------
  // frontend: chat data in the browser

  {
    symbol: 'frontend/src/store/api.ts#api',
    status: 'verified',
    summary:
      "The browser's data layer for chats, credits, payments and usage: an RTK Query API whose calls all go to the app's own /api.",
    how: [
      'fetchBaseQuery uses the base URL /api, so every call goes to the Next.js proxy, which forwards it to the gateway with the session cookie.',
      'listChats is an infinite query for the sidebar: the first page is GET /api/chats, later pages add ?cursor=, and getNextPageParam reads nextCursor (null ends the list).',
      'searchChats is GET /api/chats?query=, getChat is GET /api/chats/:id and createChat is POST /api/chats. getAccount is GET /api/billing/account, the plan and balance, with the Account tag.',
      'getPlans is GET /api/billing/plans and getPayments GET /api/billing/payments (the Payment tag). createOrder posts { planId } to /api/billing/orders and invalidates Payment; verifyPayment posts the checkout result to /api/billing/orders/:orderId/verify and invalidates Account and Payment.',
      'getUsageSummary is GET /api/usage/summary with the number of days and the time zone, and getUsageEvents GET /api/usage/events?limit=30. Both provide the Usage tag, which the chat thread invalidates when an answer finishes.',
      "getFile is GET /api/files/:id, a file's name and state, for attachment chips and generated files.",
      'updateChat (PATCH, to rename or pin) and deleteChat (DELETE) change the cached list straight away in onQueryStarted, and undo that change if the call fails.',
      'The list queries provide the Chat LIST tag and getChat its own Chat tag. createChat, updateChat and deleteChat invalidate LIST, and updateChat also its chat, so those are fetched again once the call is done.',
    ],
    why: "The sidebar, the small-screen panel and the recent chats in search use the same listChats cache, so one fetch serves them all. The optimistic changes make rename, pin and delete feel instant, and the undo keeps the list true when the server refuses. NewChatComposer calls createChat for a new chat's first message, and the chat thread writes the usage and title events of an answer into the getAccount and getChat caches.",
    returns:
      'The API object: its reducer, middleware, endpoints and hooks such as useListChatsInfiniteQuery and useUpdateChatMutation.',
    tests: [FRONTEND_CHATS_TEST, FRONTEND_CREDITS_TEST, FRONTEND_BILLING_TEST],
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
    summary: "Makes the Redux store: RTK Query's reducer and middleware, and the pending slice.",
    how: [
      "The root reducer is written by hand (rootReducer): it runs api.reducer and the pending slice's reducer, and keeps the same state object when neither changed.",
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
    symbol: 'frontend/src/server/gateway-fetch.ts#gatewayGet',
    status: 'verified',
    summary: "A GET to the gateway from a server component, with the browser's cookies.",
    how: [
      'With no gilder_sid cookie it returns null and calls nothing.',
      "Otherwise it fetches GATEWAY_URL plus the path, with the browser's cookies, x-gilder-client: web, the visitor's x-forwarded-for when there is one, and cache: 'no-store'.",
    ],
    why: "Server components skip the /api proxy and call the gateway directly. Reading cookies makes the caller per-request, so callers sit inside a Suspense boundary. It sends no Origin, which a GET does not need, and no request ID, so the gateway makes one. Without the visitor's address, every server render counted against the Next.js server's single per-IP limit at the gateway; the end-to-end run found it. getCurrentUser and getChatWithHistory use it.",
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
    why: 'It shows a skeleton in a Suspense boundary while ChatView loads the chat with getChatWithHistory. ChatView then renders ChatHeader and ChatThread with the latest messages, or calls notFound() when the chat is not available. ChatThread is a client component, but the server renders it to HTML too, so the history shows on first paint.',
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

  // -------------------------------------------------------------------------------------------
  // frontend: credits

  {
    symbol: 'frontend/src/components/billing/credits-card.tsx#CreditsCard',
    status: 'verified',
    summary: 'The balance and plan, above the account menu.',
    how: [
      'getAccount loads GET /api/billing/account in the browser; a skeleton shows meanwhile.',
      "It shows the balance (with Indian digit grouping, and 'credit' for exactly 1) and a badge with the plan's name.",
      "Below LOW_BALANCE (10) the coin turns to the warning color and 'Running low' appears.",
      "A 'Get more' link opens the billing page (/settings/billing).",
      'If billing cannot answer, the card renders nothing: the rest of the app works without it.',
    ],
    why: 'Every answer costs credits, so the balance stays in view, in the sidebar and in the small-screen panel.',
    returns: 'The card as JSX, or null.',
    tests: [FRONTEND_CREDITS_TEST],
  },
  {
    symbol: 'frontend/src/lib/billing.ts#PLAN_NAMES',
    status: 'verified',
    summary: "The name shown for each plan: 'Free', 'Starter' and 'Pro'.",
    why: "The credits card's badge reads it; the Account type next to it has the same shape as billing's toAccount.",
    returns: 'A map from plan ID to name.',
    tests: [FRONTEND_CREDITS_TEST],
  },
  {
    symbol: 'frontend/src/lib/billing.ts#LOW_BALANCE',
    status: 'verified',
    summary: 'Below this many credits the card warns that the balance is running low: 10.',
    why: 'Ten credits is one answer from most agents, so the warning comes while there is still something left.',
    returns: 'The number 10.',
    tests: [FRONTEND_CREDITS_TEST],
  },
  {
    symbol: 'frontend/src/test/mock-api.ts#mockApi',
    status: 'verified',
    summary:
      'Stands in for the network in component tests: records every /api call and answers it.',
    why: "Node's Request needs an absolute URL, so it resolves '/api/...' against http://localhost:3000 as a browser would, then records the method, path and JSON body of each call and returns what the test's answer function gives. The chat and credits card tests use it.",
    returns: 'The list of recorded calls.',
    sideEffects: ['Replaces the global fetch and Request until vi.unstubAllGlobals() runs.'],
    tests: [FRONTEND_CHATS_TEST, FRONTEND_CREDITS_TEST],
  },
  {
    symbol: 'frontend/src/test/mock-api.ts#json',
    status: 'verified',
    summary: 'A JSON Response for a mocked call, 200 unless told otherwise.',
    why: 'The tests answer most calls with JSON, so this keeps them short.',
    returns: 'A Response.',
    tests: [FRONTEND_CHATS_TEST, FRONTEND_CREDITS_TEST],
  },

  {
    symbol: 'frontend/src/components/billing/billing-view.tsx#BillingView',
    status: 'verified',
    summary: 'The billing page: the current plan and balance, the plans to buy, and past payments.',
    how: [
      'It loads the account, the plans and the payments with RTK Query. Unless the plans say testMode is false, a note says only test payments are taken (a Razorpay test card, or the UPI ID success@razorpay).',
      "Buy creates an order (createOrder), opens Razorpay's checkout (openCheckout) and sends the result to verifyPayment. While one purchase runs, every Buy button is off.",
      "A grant shows '<credits> credits added', a payment already added says so, and a closed window does nothing. Any failure shows 'The payment did not go through' with the message and, for a server error, its request ID.",
      "The history lists each payment's date, plan, credits, amount in rupees and status. Billing returns only paid payments, so an abandoned checkout never shows as a failure.",
    ],
    why: 'Everything about credits is on one page, and the browser never decides a price or whether a payment counts.',
    returns: 'The page as JSX.',
    tests: [FRONTEND_BILLING_TEST],
  },
  {
    symbol: 'frontend/src/components/billing/usage-view.tsx#UsageView',
    status: 'verified',
    summary: 'The usage page: where the credits went in the last 30 days.',
    how: [
      "It reads the browser's time zone once, and loads the summary for 30 days in that zone and the latest answers.",
      "Two tiles show the credits used and the number of answers. A chart shows the credits per day (DailyChart, after fillDays); a bar per agent shows its credits and answers, with every row on one shared grid (each row a subgrid), so every bar's track has the same width however long its label is; a table lists the latest answers with their agent, credits, tokens in and out, and time taken.",
      'Agents are shown by name (Chat, Search, Code and so on). Skeletons show while loading, and a short line when there is nothing yet.',
    ],
    why: 'People can see what each kind of answer costs them. The numbers come from the ledger, so they always match the balance.',
    returns: 'The page as JSX.',
    tests: [FRONTEND_BILLING_TEST],
  },
  {
    symbol: 'frontend/src/components/billing/daily-chart.tsx#DailyChart',
    status: 'verified',
    summary: 'Credits per day as columns, with a tooltip and a table for screen readers.',
    how: [
      'One column per day in the --chart-bar colour, at most 24px wide with a 2px gap and a rounded top, all from one baseline. A day with usage is at least 2% tall; a day without has no column.',
      'The axis shows 0 and a rounded top (niceMax), and the first and last days are labelled under it.',
      'Hovering a day dims the others and shows its date and credits in a tooltip that stays inside the chart (tooltipPosition).',
      'The chart is an image with a label that gives the total; a visually hidden table lists every day and its credits.',
    ],
    why: 'One series needs no legend, because the heading names it. --chart-bar is the accent in light mode and a step darker than the accent in dark mode, so the columns stay in the same lightness range as other data colours. The hidden table gives screen readers the same numbers.',
    returns: 'A figure as JSX.',
    tests: [FRONTEND_BILLING_TEST],
  },
  {
    symbol: 'frontend/src/components/billing/daily-chart.tsx#fillDays',
    status: 'verified',
    summary:
      "Every day in the window, oldest first, with 0 for days without usage, ending on the viewer's today.",
    how: [
      "It works out today's date in the given time zone (the one billing grouped by), then lists that many days back from it.",
    ],
    why: "Billing lists only the days that had usage. Counting today in the viewer's zone, not in UTC, keeps the last column on their today.",
    returns: 'A list of { date, credits }.',
    tests: [FRONTEND_DAILY_CHART_TEST],
  },
  {
    symbol: 'frontend/src/components/billing/daily-chart.tsx#niceMax',
    status: 'verified',
    summary:
      'A clean top for the axis: 1, 2 or 5 times a power of ten, at or above the largest value.',
    why: 'An axis that ends at 50 reads more easily than one that ends at 43.',
    returns: 'The axis top; 1 when there is no usage.',
    tests: [FRONTEND_DAILY_CHART_TEST],
  },
  {
    symbol: 'frontend/src/components/billing/daily-chart.tsx#tooltipPosition',
    status: 'verified',
    summary: 'Where the tooltip sits: over its day, but kept inside the chart near either edge.',
    how: [
      'It is centred over the day, except in the first and last fifth of the chart, where it lines up with the day on the inside instead.',
    ],
    why: "The tooltip's text is never cut off at the chart's edges.",
    returns: '{ left, transform } for the style.',
    tests: [FRONTEND_DAILY_CHART_TEST],
  },
  {
    symbol: 'frontend/src/lib/razorpay-checkout.ts#openCheckout',
    status: 'verified',
    summary: "Opens Razorpay's payment window and waits for the result.",
    how: [
      'loadCheckout adds checkout.js to the page the first time it is needed, once even if two calls race; a failed load can be tried again.',
      "It opens the window with the key ID, the amount, the currency, the order ID, the name GilderAi, the plan as the description and the app's --accent colour.",
      'It resolves with the payment ID and signature when the payment succeeds, or with null when the user closes the window.',
    ],
    why: "The payment script loads only for people who buy, and card and UPI details stay inside Razorpay's window. The result counts for nothing until billing checks its signature.",
    returns: '{ paymentId, signature }, or null.',
  },
  {
    symbol: 'frontend/src/lib/billing.ts#formatRupees',
    status: 'verified',
    summary: 'Shows paise as rupees: 19900 becomes ₹199.',
    how: ['It divides by 100 and formats with Indian digit grouping and at most two decimals.'],
    why: 'Billing works in whole paise; people read rupees.',
    returns: "A string such as '₹199'.",
    tests: [FRONTEND_BILLING_TEST],
  },
  {
    symbol: 'frontend/src/app/(app)/settings/billing/page.tsx#BillingPage',
    status: 'verified',
    summary: 'The /settings/billing page, titled Billing.',
    why: 'It renders BillingView inside the signed-in app shell. The login gate sends a visitor without a session cookie to /login first.',
    returns: 'BillingView.',
  },
  {
    symbol: 'frontend/src/app/(app)/settings/usage/page.tsx#UsagePage',
    status: 'verified',
    summary: 'The /settings/usage page, titled Usage.',
    why: 'It renders UsageView inside the signed-in app shell. The login gate sends a visitor without a session cookie to /login first.',
    returns: 'UsageView.',
  },

  // -------------------------------------------------------------------------------------------
  // frontend: answers in the chat thread

  {
    symbol: 'frontend/src/lib/uploads.ts#uploadFile',
    status: 'verified',
    summary: 'Uploads a file to a chat in three hops.',
    how: [
      'It asks POST /api/files/uploads for a signed form, with the chat, name, type and size.',
      "It posts the form's fields, then the file, straight to storage. No answer is an ApiError 'The upload could not reach storage. Check your connection.'; a refusal is 'Storage refused the upload. Try again.'",
      'It asks POST /api/files/<file ID>/complete to check what arrived, and returns the file.',
    ],
    why: "The file never passes through the app's servers, and the server checks it before it can be used. This has been tested only against an in-memory bucket: a live run needs a bucket the agent's key can use.",
    returns: 'A promise of the uploaded file.',
    tests: [FRONTEND_UPLOADS_TEST, FRONTEND_CHAT_THREAD_TEST],
  },
  {
    symbol: 'frontend/src/lib/uploads.ts#uploadProblem',
    status: 'verified',
    summary: "A reason a file can't be attached, checked before uploading.",
    how: [
      "A type other than PDF, PNG, JPEG or WebP is 'Attach a PDF, or a PNG, JPEG or WebP image'; a file over its limit (20 MB for a PDF, 10 MB for an image) names the limit.",
    ],
    why: 'The user hears at once, without a round trip; the server checks the same limits again.',
    returns: 'A message, or null when the file is fine.',
    tests: [FRONTEND_UPLOADS_TEST],
  },
  {
    symbol: 'frontend/src/lib/uploads.ts#ACCEPTED_TYPES',
    status: 'verified',
    summary: 'The types the file picker offers: PDF, PNG, JPEG and WebP.',
    why: "The composer's file input accepts only these, the same list the agent takes.",
    returns: 'A read-only array of four MIME types.',
  },
  {
    symbol: 'frontend/src/lib/uploads.ts#pdfReadingState',
    status: 'verified',
    summary: 'Whether an uploaded PDF has finished being read for questions.',
    why: 'The chat thread asks every 2 seconds, for up to 3 minutes, so the chip can say Reading… and Send can wait.',
    returns: "'indexing', 'ready', 'failed', or null for a file that is not a PDF.",
    tests: [FRONTEND_CHAT_THREAD_TEST],
  },
  {
    symbol: 'frontend/src/lib/uploads.ts#openFile',
    status: 'verified',
    summary: 'Opens a fresh, short-lived download link for a file in a new tab.',
    why: 'Links are made on request, so an attachment chip or a download button always works, even in an old chat.',
    returns: 'A promise that resolves once the tab is opened.',
  },
  {
    symbol: 'frontend/src/components/chat/generated-files.tsx#GeneratedFiles',
    status: 'verified',
    summary: 'The files an answer made: an image shown in place, or a download card.',
    how: [
      "Each file's details come from getFile (GET /api/files/<file ID>), with a skeleton meanwhile.",
      'A PDF or deck shows a card with its name and Download, which opens a fresh link.',
      "An image asks for its own fresh link (GeneratedImage) and shows itself, with alt text from its name and a Download button; if the link cannot be had, it says 'The image could not be loaded.'",
    ],
    why: 'Answers keep file IDs, never links, so each link is made when it is needed and is always valid.',
    returns: 'The files as JSX.',
    tests: [FRONTEND_CHAT_THREAD_TEST],
  },
  {
    symbol: 'frontend/src/components/chat/message-item.tsx#AttachmentChip',
    status: 'verified',
    summary: 'A file sent with a message: its name, opening a fresh download link on click.',
    why: 'The user can see and open what they sent; the name comes from getFile.',
    returns: 'A button as JSX.',
    tests: [FRONTEND_CHAT_THREAD_TEST],
  },
  {
    symbol: 'frontend/src/components/chat/message-item.tsx#Citations',
    status: 'verified',
    summary: "The PDF pages an answer is based on, under 'From your documents'.",
    why: 'Each file name and page is listed, with the quoted passage on hover, so the reader can check the answer.',
    returns: 'A section as JSX.',
    tests: [FRONTEND_CHAT_THREAD_TEST],
  },
  {
    symbol: 'frontend/src/components/chat/composer.tsx#PendingAttachment',
    status: 'verified',
    summary:
      'A file being attached to the next message, with its state: uploading, reading, ready or failed.',
    why: 'The composer shows a chip per file with its state, and Send waits until every file is ready.',
    tests: [FRONTEND_CHAT_THREAD_TEST],
  },

  {
    symbol: 'frontend/src/lib/turns.ts#streamTurn',
    status: 'verified',
    summary:
      'Sends a message (or a regenerate or edit) and yields the answer events as they stream.',
    how: [
      'It posts to /api/chats/<id>/messages, or its /<message ID>/regenerate or /edit, with the JSON body each needs (a send adds attachments when there are any) and Accept: text/event-stream.',
      "A failed fetch is an ApiError 'Could not reach GilderAi. Check your connection.', unless the caller aborted.",
      'A refusal before the stream (not 2xx) becomes an ApiError with the code, the detail and the request ID from the problem+json body or the X-Request-Id header.',
      'Otherwise it reads the body with readServerEvents and yields each event: meta, agent, sources, artifact, citations, progress, file, token, usage, title, error and done. An abort ends it quietly.',
    ],
    why: 'One request sends the message and carries the answer back. Refusals stay ordinary errors, so the thread can undo its optimistic view.',
    returns: 'An async generator of TurnEvents.',
    tests: ['frontend/src/lib/turns.test.ts', 'frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/lib/turns.ts#stopTurn',
    status: 'verified',
    summary: 'Asks the server to stop an answer.',
    why: 'It posts /api/turns/<turn ID>/stop and ignores failures: the browser stops reading anyway, and closing the stream stops the answer on the server too.',
    returns: 'A promise that resolves when the request is done.',
    tests: ['frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/lib/turns.ts#newClientMessageId',
    status: 'verified',
    summary: 'A fresh ID for one send, regenerate or edit.',
    why: "A random UUID without its dashes (32 letters and digits), which fits the server's 8-to-64-character rule. The server uses it for the lock and the credit hold, so a retried request is answered and charged once.",
    returns: 'A string.',
  },
  {
    symbol: 'frontend/src/lib/turns.ts#BUILT_AGENTS',
    status: 'verified',
    summary:
      "The agents the composer offers: 'chat', 'search', 'code', 'pdf', 'slides' and 'image'.",
    why: 'The menu and the / shortcut hints only show agents that are built. The question agents are not offered: an attachment picks them.',
    returns: 'A read-only array of six names.',
  },
  {
    symbol: 'frontend/src/lib/sse.ts#readServerEvents',
    status: 'verified',
    summary: 'Reads a server-sent events body as it arrives and yields each named event.',
    why: "Events end with a blank line and may arrive split across chunks; comments (the server's ': ping') are skipped, and data that is not JSON is passed on as text. An abort cancels the reader at once, so a stop ends the read even where the network layer would keep the body open.",
    returns: 'An async generator of { event, data }.',
    tests: ['frontend/src/lib/sse.test.ts'],
  },
  {
    symbol: 'frontend/src/hooks/use-chat-thread.ts#useChatThread',
    status: 'verified',
    summary:
      'The messages of one chat, and the answer being written: send, regenerate, edit and stop.',
    how: [
      "Sending shows the user's message and an empty answer at once, then fills the answer in from the events: the IDs from meta, the agent, sources, files and each token.",
      'Tokens are not applied one by one: the words that arrive before the next frame are added in one update (nextFrame), so a fast stream renders at most once per frame. Any other event, the end of the stream and a failure first add what is waiting, so the order never changes.',
      'A usage event writes the new balance into the cached account, and a title event the new title into the cached chat; afterwards the chat list, the chat and the usage page data (the Usage tag) are refetched.',
      'An error event marks the answer failed with its message and reference, and shows a toast.',
      "A refusal before the stream puts the thread back as it was and shows a toast ('Out of credits' for a 402); the composer gets the text back.",
      'Citations, progress and file events go onto the answer: the cited pages, the current part of a file being made (removed when the answer ends) and the IDs of the files it made. A send can carry attachments, which show on the message at once.',
      'regenerate hides the latest answer and asks for a new one; edit replaces the latest user message and what follows. Only one answer runs at a time.',
      'stop posts the stop request (once the turn ID is known) and aborts the stream; the answer is kept as stopped.',
      "Leaving the page aborts a running answer, but only after a tick, so React's development double mount does not stop it by mistake.",
    ],
    why: 'The thread feels instant, and the server stays the source of truth for what was saved and charged.',
    returns: '{ messages, running, send, regenerate, edit, stop }',
    tests: ['frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/hooks/use-chat-thread.ts#toThreadMessage',
    status: 'verified',
    summary: 'Turns a saved message into a message of the thread.',
    why: "It keeps the ID, role, text, status and agent, and adds the sources and the files of the first artifact when there are any, so a reopened chat shows a search answer's sources and a code answer's files.",
    returns: 'A ThreadMessage.',
    tests: ['frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/store/pending-slice.ts#pendingSlice',
    status: 'verified',
    summary: "A new chat's first message, between the new-chat page and the chat page.",
    why: "queueFirstMessage stores { chatId, content, clientMessageId, agent? } under the chat's ID and clearFirstMessage removes it, so the message typed on / is sent from the chat's own page once it opens.",
    returns: 'A Redux Toolkit slice.',
    tests: ['frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/chat-thread.tsx#ChatThread',
    status: 'verified',
    summary: "A chat's conversation and its composer.",
    how: [
      'It renders each message with MessageItem, or an empty state, and the composer stuck to the bottom.',
      "A message queued by the new-chat page is cleared and sent once, as soon as the page opens; a ref keeps React's double effects in development from sending it twice.",
      'While an answer streams it keeps the bottom in view, unless the user scrolls up to read; a new answer always brings the bottom back. Only a move up away from the bottom stops following, so text growing faster than scroll events arrive never does; scrolling back within 120px of the end follows again.',
      'It scrolls <main> itself to its very end (scrollToEnd) in a layout effect, before the frame is drawn: the newest line sits just above the composer instead of under it, new text never shows below the fold first, and the page around the app never scrolls (scrollIntoView would scroll it too).',
      'Picked files are checked (uploadProblem) and uploaded at once (uploadFile), each with a chip; a PDF is then polled every 2 seconds, for up to 3 minutes, until it has been read. A failure shows a toast. Send passes the IDs of the ready files and clears the chips once the message is taken.',
      'The scroll anchor sits after the message list, since a list may hold only list items.',
      'Regenerate is offered on the latest answer and Edit on the latest user message, only when nothing is running. Editing swaps the message for an edit box (Save and send, or Esc to cancel); ↑ in an empty composer opens it too.',
    ],
    why: "The chat page's whole conversation in one place, rendered first on the server with the history.",
    returns: 'The thread as JSX.',
    tests: [FRONTEND_CHAT_THREAD_TEST, FRONTEND_UPLOADS_TEST],
  },
  {
    symbol: 'frontend/src/components/chat/composer.tsx#Composer',
    status: 'verified',
    summary:
      'The message box, with the paperclip, the agent picker, shortcut hints and the send or stop button.',
    how: [
      'Enter sends and Shift+Enter makes a new line; the box grows with its text up to a limit. Messages are at most 20,000 characters.',
      'In a chat, the paperclip picks PDFs and PNG, JPEG or WebP images (ACCEPTED_TYPES). Each file gets a chip with its state (Uploading…, Reading…, Failed) and a remove button, and Send waits until every file is ready.',
      'An agent menu offers Auto and the built agents (Chat, Search, Code, PDF, Slides, Image).',
      'Typing / shows the matching shortcuts (/search, /code, /pdf, /slides, /image) with a hint each.',
      "With no credits it says 'You are out of credits. New answers need credits.' and cannot send.",
      'While an answer runs, Send becomes Stop, and Esc stops it from anywhere on the page. ↑ in an empty box edits the latest message.',
      'The text is cleared on send and comes back if the message is refused.',
    ],
    why: 'One composer serves the new-chat page and every chat; only a chat passes onAttach, since a file belongs to a chat.',
    returns: 'The form as JSX.',
    tests: ['frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/composer.tsx#AGENT_OPTIONS',
    status: 'verified',
    summary: 'Every agent the composer knows, with its label, / shortcut and hint.',
    why: 'It lists the six agents a user can pick, all of them built now; the composer offers only those in BUILT_AGENTS.',
    returns: 'A read-only array of options.',
  },
  {
    symbol: 'frontend/src/components/chat/new-chat.tsx#NewChatComposer',
    status: 'verified',
    summary: "The new-chat page's composer: the first message creates the chat.",
    why: "It creates the chat (createChat), queues the message in the pending slice with a fresh client ID, and opens /c/<id>, where the chat thread sends it. If the chat cannot be created, a toast says 'Could not start a chat' and the text comes back. No empty chats are ever made.",
    returns: 'The composer as JSX.',
    tests: ['frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/message-item.tsx#MessageItem',
    status: 'verified',
    summary: 'MessageItemView, memoised.',
    why: "While an answer streams, only that answer's object changes (useChatThread maps the others through unchanged), so the messages above it are not rendered again on every word. Regenerate and Edit are only passed when nothing runs, so they don't break the memo while streaming.",
    returns: 'The memoised component.',
    tests: ['frontend/src/components/chat/chat-thread.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/message-item.tsx#MessageItemView',
    status: 'verified',
    summary: "One message: the user's on the right, answers on the left as Markdown.",
    how: [
      "The user's text keeps its line breaks. An answer renders as Markdown with its citations linked, three pulsing dots while it is empty, and Stopped or the failure message (with its reference) under it.",
      "A finished code answer shows its files card, and a search answer its sources. A user's message shows a chip per attached file (AttachmentChip). While a file is being made, a progress bar shows the step and how far it has got; the files an answer made show under it (GeneratedFiles), and a PDF answer shows its page marks as tags (tagPages) and lists its pages (Citations).",
      'Copy is on every finished message; Regenerate and Edit only where the thread offers them.',
    ],
    why: 'Each message carries just the actions that make sense for it.',
    returns: 'A list item as JSX.',
    tests: [
      'frontend/src/components/chat/message-item.test.tsx',
      'frontend/src/components/chat/chat-thread.test.tsx',
    ],
  },
  {
    symbol: 'frontend/src/components/chat/message-item.tsx#linkCitations',
    status: 'verified',
    summary: "Turns an answer's [n] markers into links to source n.",
    why: 'Some models cite with full-width brackets, like 【1】 or 【1†source】, so those become [1] first. Numbers with no source, markers already followed by a link, and anything inside code spans or blocks are left as written.',
    returns: 'The Markdown text with the citations linked.',
    tests: ['frontend/src/components/chat/message-item.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/message-item.tsx#tagPages',
    status: 'verified',
    summary: "Turns a PDF answer's [p. N] marks into page tags.",
    how: [
      'Each [p. N] (or 【p. N】, in answers saved before the server cleaned them) becomes a Markdown link to #page-N, whose title is the passages cited from that page.',
      'The Markdown renderer shows a #page- link as a small grey tag, not a link, with that title on hover.',
      'Marks already followed by a link, and anything inside code spans or blocks, are left as written.',
    ],
    why: 'The page a fact comes from reads as a quiet tag right after it, and the passage is one hover away.',
    returns: 'The Markdown text with the page marks tagged.',
    tests: ['frontend/src/components/chat/message-item.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/markdown.tsx#Markdown',
    status: 'verified',
    summary: "Renders a model's answer as Markdown, safely.",
    how: [
      'react-markdown with remark-gfm (tables, lists, strikethrough). Raw HTML in the text is shown as text, never run, and javascript: links are removed (its defaults).',
      'An image the model wrote becomes a plain link, never loaded (SEC-10).',
      'Links open in a new tab with noopener, noreferrer and nofollow. A #page- link (from tagPages) is shown as a small page tag instead.',
      'Code blocks get a language label, a copy button and highlight.js colours; tables scroll sideways.',
      'The text is split into its top-level blocks (splitBlocks) and each block renders separately and memoised, so while an answer streams only its last block is parsed, highlighted and rendered again.',
    ],
    why: 'Answers are model output, so nothing in them may run code, load content from elsewhere or reach this page.',
    returns: 'The rendered Markdown as JSX.',
    tests: ['frontend/src/components/chat/markdown.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/markdown.tsx#splitBlocks',
    status: 'verified',
    summary: 'Splits Markdown into its top-level blocks, keeping every character.',
    how: [
      'It parses with the same parser as the renderer (unified with remark-parse and remark-gfm) and cuts the text at the start of each top-level node, so each block keeps the blank lines after it.',
      'A blank line inside a code block or a list item is part of that node, so it never splits it.',
      'Text with reference links or footnotes stays whole, because their definitions can sit in another block; so does text the parser gives no positions for.',
    ],
    why: 'Re-rendering a whole answer on every word made long answers stutter (120–210 ms frames in development). Finished blocks never change while an answer streams, so only the last one needs work.',
    returns: 'The blocks, which joined give back the text.',
    tests: ['frontend/src/components/chat/markdown.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/files-card.tsx#FilesCard',
    status: 'verified',
    summary:
      'Under a code answer: how many files it made, their names, and a button that opens them.',
    why: 'The files are one click away without filling the chat; it opens ArtifactPanel.',
    returns: 'The card, and the panel when open, as JSX.',
    tests: ['frontend/src/components/chat/artifact-panel.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/artifact-panel.tsx#ArtifactPanel',
    status: 'verified',
    summary:
      'The files of a code answer in a side panel: a tab per file, a preview, and downloads.',
    how: [
      'Each file shows in the read-only Monaco editor (CodeEditor) with its language, a copy button and a download button. While Monaco loads, the same file shows as highlighted code (CodeView), so the panel is never empty.',
      'Download all saves every file as gilderai-files.zip.',
      "When there is an HTML file, a Preview tab shows previewDocument's page in an iframe sandboxed with allow-scripts only.",
    ],
    why: 'Scripts may run in the preview, but with no same-origin access: no cookies, no storage, no access to the app. Monaco gives line numbers, folding and find; code blocks inside answers keep the lighter highlighter, since loading Monaco for every snippet would be heavy.',
    returns: 'A Radix dialog as JSX.',
    tests: [
      'frontend/src/components/chat/artifact-panel.test.tsx',
      'frontend/src/components/chat/code-editor.test.tsx',
    ],
  },
  {
    symbol: 'frontend/src/components/chat/code-editor.tsx#CodeEditor',
    status: 'verified',
    summary: "A file in the read-only Monaco editor, in the app's theme.",
    how: [
      'Monaco is served by the app from /monaco/vs: scripts/copy-monaco.mjs copies its browser files from node_modules into public/monaco before dev and build (git-ignored, skipped when the version already matches), and loader.config points the loader there, so nothing comes from a CDN and the security policy needs no change.',
      'Read-only (also for the DOM), line numbers, folding, find and word wrap; no minimap; the file name is its label for screen readers.',
      "The theme follows the page (<html data-theme>, else the system), and a switch while the panel is open re-applies it. defineAppTheme builds the Monaco theme from the page's own colour variables.",
    ],
    why: 'The editor of VS Code makes long files easy to read. Self-hosting costs about 25 MB of static files, loaded on demand only when a code panel opens.',
    returns: 'The editor, or its fallback while Monaco loads.',
    tests: ['frontend/src/components/chat/code-editor.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/code-editor.tsx#monacoLanguage',
    status: 'verified',
    summary: "Monaco's name for a file's language.",
    why: "The language the answer gave wins, with common short forms mapped (js, jsx, ts, tsx, py, sh, bash, yml, md, htm); a missing or plain-text one falls back to the file's extension, and to plaintext when there is none.",
    returns: 'A Monaco language ID.',
    tests: ['frontend/src/components/chat/code-editor.test.tsx'],
  },
  {
    symbol: 'frontend/src/components/chat/code-editor.tsx#defineAppTheme',
    status: 'verified',
    summary: "Defines a Monaco theme in the app's colours and returns its name.",
    why: "It reads --sunken, --text and --text-subtle from the page for the theme showing now, on top of Monaco's vs or vs-dark, so the editor matches the panel. Only hex values are passed, since Monaco accepts nothing else.",
    returns: "'gilder-light' or 'gilder-dark'.",
    tests: ['frontend/src/components/chat/code-editor.test.tsx'],
  },
  {
    symbol: 'frontend/src/lib/code-files.ts#previewDocument',
    status: 'verified',
    summary:
      'The page the preview frame shows, with its CSS and JavaScript put inline and the network blocked.',
    why: "The frame cannot fetch the other files, so local stylesheets and scripts are inlined and any it cannot find are dropped. A Content-Security-Policy of default-src 'none' (inline styles and scripts and data: images and fonts only) means the page cannot load anything from anywhere or send anything out. Null when there is no HTML file.",
    returns: 'The HTML text, or null.',
    tests: [
      'frontend/src/lib/code-files.test.ts',
      'frontend/src/components/chat/artifact-panel.test.tsx',
    ],
  },
  {
    symbol: 'frontend/src/lib/code-files.ts#zipFiles',
    status: 'verified',
    summary: 'All the files as one .zip.',
    why: 'fflate packs every file under its path in the browser, so no server is needed for a download.',
    returns: 'A Blob of type application/zip.',
    tests: ['frontend/src/lib/code-files.test.ts'],
  },
  {
    symbol: 'frontend/src/lib/code-files.ts#download',
    status: 'verified',
    summary: 'Saves a Blob as a file through a temporary link.',
    why: 'It clicks an object URL with a download name and revokes it a second later.',
  },
  {
    symbol: 'frontend/src/lib/highlight.ts#highlightCode',
    status: 'verified',
    summary: 'Code as highlighted HTML, or null for a language that is not loaded.',
    why: "highlight.js's core is loaded with only the common languages (bash, CSS, Go, Java, JavaScript, JSON, Markdown, Python, Rust, SQL, TypeScript, HTML/XML, YAML) and aliases such as ts, py and html, to keep the bundle small. It escapes the code itself, so its HTML only adds colour spans and is safe to insert.",
    returns: 'An HTML string, or null.',
    tests: ['frontend/src/lib/highlight.test.ts'],
  },
];

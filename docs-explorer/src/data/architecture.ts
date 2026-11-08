import type { ArchComponent, ArchLink } from './schema.ts';

/**
 * The system map: every app, data store and outside service, and how they connect.
 *
 * Built today: the gateway, which checks each /api request and forwards the sign-in, logout and
 * profile routes to auth; auth, which serves them; chat, agent and billing, locked behind the
 * internal-token check but with no routes yet; a starter frontend page; and local MongoDB, Redis
 * and Qdrant in Docker. Everything else is marked `planned`, with the roadmap feature that adds
 * it.
 *
 * Link kinds used here: `http` for HTTP calls between programs, `internal` for an app importing
 * the shared library (same process, no network), `data` for a connection to a data store, and
 * `external` for calls to an outside service.
 */

export const components: ArchComponent[] = [
  // -------------------------------------------------------------------------------------------
  // Client and apps

  {
    id: 'browser',
    name: 'Browser',
    kind: 'client',
    status: 'verified',
    summary:
      "The user's web browser. It loads the GilderAi pages from the frontend and calls only the frontend's own /api routes, so it never sees a backend address. Google sign-in opens a Firebase popup.",
    responsibilities: [
      'Loads the pages from the frontend on port 3000: /login, and the signed-in app at /, which the login gate sends to /login when there is no session cookie.',
      'Calls /api/* on the frontend itself (apiFetch), which turns problem+json errors into ApiError with the code and request ID.',
      'Keeps the HttpOnly session cookie, which page scripts cannot read, and a gilder_theme cookie for the theme.',
      'Google sign-in opens a Firebase popup and sends the ID token to /api/auth/session.',
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend (Next.js)',
    kind: 'app',
    status: 'verified',
    summary:
      'The Next.js app the user opens. Its server forwards every /api/* call to the gateway, so backend addresses and secrets never reach the browser. It has the sign-in page and the signed-in app shell.',
    responsibilities: [
      'Forwards /api/* to GATEWAY_URL (forwardToGateway, in the api/[...path] route): it passes the cookie, Origin and forwarded address, adds a request ID and x-gilder-client: web, streams the answer and its Set-Cookie headers back, answers 503 when the gateway is down, and cancels the call when the browser goes away.',
      'Login gate (proxy.ts): a visitor without a session cookie who opens /, /c/... or /settings/... goes to /login.',
      'Sign-in page (/login): Google sign-in through a Firebase popup, disabled until the NEXT_PUBLIC_FIREBASE_* settings are set, and dev sign-in by email in development builds only.',
      "App shell (the (app) layout): a sidebar (a top bar on small screens) with New chat and the account menu (theme, sign out). Server components confirm the session with the gateway's /api/me (getCurrentUser) inside a Suspense boundary, so the shell is prerendered.",
      'Design system: Light minimal tokens in light and dark, Radix-based components, and a theme remembered in a cookie and applied before the first paint.',
      'Security headers on every page (next.config.ts): a Content-Security-Policy without nonces, nosniff, referrer and permissions policies, and no framing.',
      'Reads GATEWAY_URL on the server and the public NEXT_PUBLIC_FIREBASE_* values in the browser. NEXT_PUBLIC_RAZORPAY_KEY_ID is listed for payments, but no code reads it yet.',
    ],
    path: 'frontend',
    port: 3000,
    entryPoints: [
      'frontend/src/app/layout.tsx#RootLayout',
      'frontend/src/app/(app)/layout.tsx#AppLayout',
      'frontend/src/server/gateway-proxy.ts#forwardToGateway',
      'frontend/src/proxy.ts#proxy',
    ],
  },
  {
    id: 'gateway',
    name: 'Gateway',
    kind: 'app',
    status: 'verified',
    summary:
      'The one public entry to the backend. Each /api request goes through its checks (rate limits, the route allowlist, the origin check and the session lookup) and is then forwarded to its service with a fresh signed internal token. Its route table lists only the auth routes so far. The services also listen on their own ports, but each one answers 401 to anything without a valid token except its health checks.',
    responsibilities: [
      "Builds its Express app with createService, with parseJson: false and its /api router as its routes, after the shared middleware and GET /healthz and GET /readyz. Express's trust proxy is set to TRUST_PROXY_HOPS, so req.ip is the client's address.",
      'Limits each IP address to 120 requests a minute (ipRateLimit), for every request that reaches the router, and each signed-in user to 60 (userRateLimit). Over the limit is a 429 with Retry-After.',
      "Forwards only what its route table (PUBLIC_ROUTES) lists: POST /api/auth/session, POST /api/auth/dev-session, DELETE /api/auth/session, and GET and PATCH /api/me, all to auth. Anything else gets the gateway's own 404 and never reaches a service.",
      'Refuses a request that changes something (any method but GET, HEAD and OPTIONS) unless its Origin is one of FRONTEND_ORIGIN, with 403 (originCheck).',
      'Looks the session cookie up in Redis on every matched request, which renews it (sessionLookup), and answers 401 itself for a route that needs a session when there is none (requireSession).',
      'Forwards the request (proxyToService) with fetch: raw body up to 1 MB, a few allowed headers, the cookie only to auth, X-Request-Id, and an internal token signed for that service that names the user. It passes back the status, a few headers, every Set-Cookie and the streamed body. A service that is down or does not start answering within 10 seconds gives 503.',
      'Checks its settings at startup (rules in env-schema.ts) and refuses to start if one is missing or invalid: REDIS_URL, FRONTEND_ORIGIN (one origin or a comma-separated list), the four service URLs and INTERNAL_PRIVATE_KEY, which must parse as an Ed25519 private key. PORT, NODE_ENV, LOG_LEVEL and TRUST_PROXY_HOPS (1) have defaults.',
      'Opens a Redis client at startup. /readyz says ready only when Redis answers PING.',
      'On SIGTERM or SIGINT, finishes in-flight requests and then closes the Redis client.',
    ],
    path: 'backend/gateway',
    port: 8000,
    entryPoints: [
      'backend/gateway/src/index.ts#(module)',
      'backend/gateway/src/app.ts#createApp',
      'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
      'backend/gateway/src/proxy.ts#proxyToService',
    ],
  },
  {
    id: 'auth',
    name: 'Auth service',
    kind: 'app',
    status: 'verified',
    summary:
      "Handles sign-in, logout and the user's profile. Its session and /me routes sit behind the internal-token check, so a direct call to any path except the health checks gets 401. The gateway forwards the public sign-in, logout and /me routes to it, each with a token it signs.",
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (the internalAuth option, audience auth) in front of its own routes. A call without a valid token gets 401 on any path except the health checks; an unknown path with a valid token gets 404.',
      'Connects to MongoDB at startup and does not start serving until the connection works.',
      'Opens a Redis client at startup. /readyz says ready only when both MongoDB and Redis answer.',
      'Imports INTERNAL_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      "Is reached through the gateway's route table: POST /api/auth/session → POST /sessions, POST /api/auth/dev-session → POST /sessions/dev, DELETE /api/auth/session → DELETE /sessions/current, GET and PATCH /api/me → /me. GET /internal/users/:id has no public route.",
      'Serves the sign-in routes (sessionRouter): POST /sessions for Google, POST /sessions/dev only when AUTH_DEV_LOGIN is on (otherwise the path is a 404), and DELETE /sessions/current for logout. They create or delete the session in Redis and set or clear the gilder_sid cookie, marked Secure when NODE_ENV is production.',
      "Serves the profile routes (meRouter): GET /me, PATCH /me to change the theme, and GET /internal/users/:id, which returns only the token's own user.",
      'Keeps users in MongoDB (UserModel, with a unique Firebase ID and a unique lowercase email); toProfile is the public shape of a user.',
      "Checks Google sign-in tokens with the Firebase Admin SDK (createFirebaseVerifier) when all three FIREBASE_* settings are set, including whether a token was revoked. A bad token gives 401, and a server-side failure stays a 500. Without the settings it uses googleSignInNotSetUp, so Google sign-in answers 503, and startup logs the warning 'Google sign-in is not set up: the FIREBASE_* settings are empty'.",
      "With AUTH_DEV_LOGIN on, startup logs the warning 'dev sign-in is on: anyone who can reach auth can sign in with just an email'.",
      'Checks its settings at startup (rules in env-schema.ts) and refuses to start if a required variable (MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY) is missing, or if any value is invalid. INTERNAL_PUBLIC_KEY (the shared internalPublicKeySchema; escaped \\n line breaks are fine) must start with -----BEGIN PUBLIC KEY-----; the message says to run pnpm setup:keys and never repeats the value. PORT, NODE_ENV, LOG_LEVEL and AUTH_DEV_LOGIN (false) have defaults.',
      'In production it also refuses AUTH_DEV_LOGIN=true and requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY; elsewhere the three are optional, but all three or none.',
      'On SIGTERM or SIGINT, finishes in-flight requests, then disconnects MongoDB and closes Redis.',
    ],
    path: 'backend/services/auth',
    port: 8001,
    entryPoints: [
      'backend/services/auth/src/index.ts#(module)',
      'backend/services/auth/src/app.ts#createApp',
    ],
  },
  {
    id: 'chat',
    name: 'Chat service',
    kind: 'app',
    status: 'verified',
    summary:
      'Will own chats and their messages. Today it answers health checks, and 401 to anything else without a valid internal token. Planned: its chat routes, reached through the gateway (Chats).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience chat). It has no routes of its own yet, so a request with a valid token gets 404.',
      'Connects to MongoDB at startup and does not start serving until the connection works. /readyz pings it.',
      'Imports INTERNAL_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI, INTERNAL_PUBLIC_KEY) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults.',
      'On SIGTERM or SIGINT, finishes in-flight requests and then disconnects MongoDB.',
    ],
    path: 'backend/services/chat',
    port: 8002,
    entryPoints: [
      'backend/services/chat/src/index.ts#(module)',
      'backend/services/chat/src/app.ts#createApp',
    ],
  },
  {
    id: 'agent',
    name: 'Agent service',
    kind: 'app',
    status: 'verified',
    summary:
      'Will run the AI agents. Today it answers health checks, and 401 to anything else without a valid internal token. Planned: LLM calls through Groq, OpenRouter and Gemini (AI answers), web search with Tavily (Web search and code), files in S3 and vectors in Qdrant (PDF and image Q&A), and images from Pollinations (File generation).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience agent). It has no routes of its own yet, so a request with a valid token gets 404.',
      'Connects to MongoDB at startup and does not start serving until the connection works.',
      'Opens a Redis client at startup. /readyz says ready only when both MongoDB and Redis answer.',
      'Imports INTERNAL_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults. Its .env.example also lists QDRANT_URL, CHAT_SERVICE_URL, BILLING_SERVICE_URL, the AI provider keys (GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, TAVILY_API_KEY) and the S3 settings (AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) for later features, but env.ts does not read them yet.',
      'On SIGTERM or SIGINT, finishes in-flight requests, then disconnects MongoDB and closes Redis.',
    ],
    path: 'backend/services/agent',
    port: 8003,
    entryPoints: [
      'backend/services/agent/src/index.ts#(module)',
      'backend/services/agent/src/app.ts#createApp',
    ],
  },
  {
    id: 'billing',
    name: 'Billing service',
    kind: 'app',
    status: 'verified',
    summary:
      'Will own credits and payments. Today it answers health checks, and 401 to anything else without a valid internal token. Planned: its routes (Credits), with credits kept in a ledger, and Razorpay payments (Payments and usage).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience billing). It has no routes of its own yet, so a request with a valid token gets 404.',
      'Connects to MongoDB at startup and does not start serving until the connection works. /readyz pings it.',
      'Imports INTERNAL_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI, INTERNAL_PUBLIC_KEY) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults. Its .env.example also lists the Razorpay settings (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) for later features, but env.ts does not read them yet.',
      'On SIGTERM or SIGINT, finishes in-flight requests and then disconnects MongoDB.',
    ],
    path: 'backend/services/billing',
    port: 8004,
    entryPoints: [
      'backend/services/billing/src/index.ts#(module)',
      'backend/services/billing/src/app.ts#createApp',
    ],
  },
  {
    id: 'shared',
    name: 'Shared library (@gilder/shared)',
    kind: 'library',
    status: 'verified',
    summary:
      'The toolkit all five backend apps import, so they all start, log, check health and fail in the same way. It runs inside each app; it is not a server.',
    responsibilities: [
      "createService builds an Express app with the middleware in a fixed order: request ID, request logging (health probes skipped), security headers (helmet), JSON body (64kb by default, only when parseJson is true, the default), /healthz and /readyz, the internal-token check (only with the internalAuth option: every route except /healthz and /readyz then needs a valid internal token, so a direct call gets 401 on any path, unless the body parser rejects its JSON body first), the app's routes, then 404 and error handling.",
      "startService opens the port and shuts down cleanly on SIGTERM or SIGINT: stop taking new connections, wait up to 10 seconds for in-flight requests, then run the app's cleanup. Later signals are ignored, so one Ctrl+C under pnpm dev, which reaches the app twice, still shuts it down cleanly.",
      "loadEnv checks each app's settings at startup and lists every problem at once, without printing the values.",
      'createLogger makes a pino logger that hides secrets such as tokens, cookies and passwords.',
      'connectMongo, pingMongo, createRedis and pingRedis open the database connections and provide the checks behind /readyz.',
      "Its setup:keys script (pnpm setup:keys) writes the gateway's private key and each service's matching public key into their .env files, without printing them.",
      "Internal tokens: the gateway imports its private key and signs a token for each forwarded request (importInternalPrivateKey, signInternalToken); auth, chat, agent and billing import the public key (internalPublicKeySchema, importInternalPublicKey) and check every token (createService's internalAuth option, requireInternalToken). Auth's user routes add requireUser.",
      'Sessions: auth creates and deletes them (createSession, deleteSession); the gateway looks them up on each request (sessionIdFromCookies, resolveSession).',
      "Rate limits: the gateway's per-IP and per-user limits (rateLimit, hitRateLimit, GATEWAY_RATE_LIMITS). The validate request middleware checks auth's request bodies and params.",
      'Built and tested, but not used by any app yet: shared constants such as agents, credit costs, per-agent rate limits and plans.',
      'createTestRedis gives each test a client on a real Redis (database 15) with its own random key prefix, and deletes its keys afterwards.',
    ],
    path: 'backend/shared',
    entryPoints: [
      'backend/shared/src/service.ts#createService',
      'backend/shared/src/service.ts#startService',
    ],
  },

  // -------------------------------------------------------------------------------------------
  // Data stores (local ones run in Docker, see backend/docker-compose.yml)

  {
    id: 'mongodb',
    name: 'MongoDB',
    kind: 'datastore',
    status: 'verified',
    summary:
      'The main database, run locally in Docker (mongo:8). It is a single-node replica set named rs0, because MongoDB transactions need a replica set; the credits ledger planned for billing will use them.',
    responsibilities: [
      'Listens on host port 27018, not the usual 27017, so it does not clash with other local projects. Data lives in the mongo-data volume.',
      'The Docker health check creates the rs0 replica set on the first run.',
      'auth, chat, agent and billing connect at startup. Each .env.example points the app at its own database: gilder_auth, gilder_chat, gilder_agent and gilder_billing.',
      'Auth keeps its users here (a unique Firebase ID and email each): its sign-in routes create or update them, and the /me routes read and save them.',
    ],
    port: 27018,
    entryPoints: ['backend/shared/src/mongo.ts#connectMongo'],
  },
  {
    id: 'redis',
    name: 'Redis',
    kind: 'datastore',
    status: 'verified',
    summary:
      'A fast key-value store, run locally in Docker (redis:7-alpine). Set up so keys are never dropped silently, because sessions live here.',
    responsibilities: [
      'Listens on host port 6380, not the usual 6379. It saves to disk (append-only file) in the redis-data volume.',
      'Sets the noeviction policy, so if a memory limit is added later, Redis will refuse new writes instead of quietly deleting keys. No memory limit (--maxmemory) is set today, so the policy does not come into play yet.',
      'gateway, auth and agent open a client at startup and send PING for /readyz. Agent reads and writes no keys yet.',
      "The shared library stores sessions as sess:<SHA-256 of the session ID>, with a 7-day expiry that each lookup renews, and rate-limit counters as rl:<scope>:<id>, whose expiry is set with the count in one MULTI. Auth's sign-in creates sessions and its logout deletes them; the gateway looks a session up on each request and counts requests per IP (rl:ip:...) and per user (rl:user:...).",
      'Tests run against a real Redis on port 6380, using database 15: the local container, or a Redis service in CI.',
    ],
    port: 6380,
    entryPoints: ['backend/shared/src/redis.ts#createRedis'],
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    kind: 'datastore',
    status: 'not-wired',
    summary:
      'A vector database, run locally in Docker. It is up and healthy, but no app connects to it yet. The agent is planned to use it for PDF and image Q&A.',
    responsibilities: [
      'Runs qdrant v1.16.0 on host port 6335, not the usual 6333. Data lives in the qdrant-data volume.',
      "No code connects to it: the agent's .env.example lists QDRANT_URL, but the agent's env.ts does not read it.",
    ],
    port: 6335,
  },
  {
    id: 's3',
    name: 'AWS S3',
    kind: 'datastore',
    status: 'planned',
    plannedIn: 'PDF and image Q&A',
    summary:
      'File storage. The agent will keep files here, even in development, which is why there is no storage container in Docker. Not built yet.',
    responsibilities: [],
  },

  // -------------------------------------------------------------------------------------------
  // Outside services (only Firebase, from auth, is called by the code today)

  {
    id: 'llm-providers',
    name: 'LLM providers (Groq, OpenRouter, Gemini)',
    kind: 'external',
    status: 'planned',
    plannedIn: 'AI answers',
    summary: 'The language models the agent will call to write answers. Not built yet.',
    responsibilities: [],
  },
  {
    id: 'tavily',
    name: 'Tavily',
    kind: 'external',
    status: 'planned',
    plannedIn: 'Web search and code',
    summary: 'A web search API the agent will use for answers with sources. Not built yet.',
    responsibilities: [],
  },
  {
    id: 'pollinations',
    name: 'Pollinations',
    kind: 'external',
    status: 'planned',
    plannedIn: 'File generation',
    summary: 'An image generation API the agent will call. Not built yet.',
    responsibilities: [],
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    kind: 'external',
    status: 'planned',
    plannedIn: 'Payments and usage',
    summary:
      'The payment provider billing will use to sell plans, in test mode. It reports payment results back by webhook. Not built yet.',
    responsibilities: [],
  },
  {
    id: 'firebase',
    name: 'Firebase Authentication',
    kind: 'external',
    status: 'verified',
    summary:
      "Google sign-in. Auth's POST /sessions checks Google sign-in tokens with the Firebase Admin SDK when its three FIREBASE_* settings are set. The gateway forwards POST /api/auth/session to that route. In the browser, the sign-in page's Google button opens the Firebase popup that gives the ID token.",
    responsibilities: [],
  },
];

export const links: ArchLink[] = [
  // -------------------------------------------------------------------------------------------
  // Built today

  {
    from: 'browser',
    to: 'frontend',
    kind: 'http',
    label: 'Pages, and every /api/* call on the same origin',
    status: 'verified',
    evidence: [
      'frontend/src/app/layout.tsx#RootLayout',
      'frontend/src/app/login/page.tsx#LoginPage',
      'frontend/src/lib/api.ts#apiFetch',
    ],
  },

  // Every backend app is built from the shared library.
  {
    from: 'gateway',
    to: 'shared',
    kind: 'internal',
    label: 'Imports @gilder/shared to load settings, build the app and start it',
    status: 'verified',
    evidence: [
      'backend/gateway/src/env.ts#env',
      'backend/gateway/src/app.ts#createApp',
      'backend/gateway/src/index.ts#(module)',
    ],
  },
  {
    from: 'auth',
    to: 'shared',
    kind: 'internal',
    label: 'Imports @gilder/shared to load settings, build the app and start it',
    status: 'verified',
    evidence: [
      'backend/services/auth/src/env.ts#env',
      'backend/services/auth/src/app.ts#createApp',
      'backend/services/auth/src/index.ts#(module)',
    ],
  },
  {
    from: 'chat',
    to: 'shared',
    kind: 'internal',
    label: 'Imports @gilder/shared to load settings, build the app and start it',
    status: 'verified',
    evidence: [
      'backend/services/chat/src/env.ts#env',
      'backend/services/chat/src/app.ts#createApp',
      'backend/services/chat/src/index.ts#(module)',
    ],
  },
  {
    from: 'agent',
    to: 'shared',
    kind: 'internal',
    label: 'Imports @gilder/shared to load settings, build the app and start it',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/env.ts#env',
      'backend/services/agent/src/app.ts#createApp',
      'backend/services/agent/src/index.ts#(module)',
    ],
  },
  {
    from: 'billing',
    to: 'shared',
    kind: 'internal',
    label: 'Imports @gilder/shared to load settings, build the app and start it',
    status: 'verified',
    evidence: [
      'backend/services/billing/src/env.ts#env',
      'backend/services/billing/src/app.ts#createApp',
      'backend/services/billing/src/index.ts#(module)',
    ],
  },

  // MongoDB: connected at startup with connectMongo, checked by /readyz with pingMongo.
  {
    from: 'auth',
    to: 'mongodb',
    kind: 'data',
    label: 'Connects at startup; /readyz pings it',
    status: 'verified',
    evidence: [
      'backend/services/auth/src/index.ts#(module)',
      'backend/services/auth/src/index.ts#app',
      'backend/shared/src/mongo.ts#connectMongo',
      'backend/shared/src/mongo.ts#pingMongo',
    ],
  },
  {
    from: 'chat',
    to: 'mongodb',
    kind: 'data',
    label: 'Connects at startup; /readyz pings it',
    status: 'verified',
    evidence: [
      'backend/services/chat/src/index.ts#(module)',
      'backend/services/chat/src/index.ts#app',
      'backend/shared/src/mongo.ts#connectMongo',
      'backend/shared/src/mongo.ts#pingMongo',
    ],
  },
  {
    from: 'agent',
    to: 'mongodb',
    kind: 'data',
    label: 'Connects at startup; /readyz pings it',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/index.ts#(module)',
      'backend/services/agent/src/index.ts#app',
      'backend/shared/src/mongo.ts#connectMongo',
      'backend/shared/src/mongo.ts#pingMongo',
    ],
  },
  {
    from: 'billing',
    to: 'mongodb',
    kind: 'data',
    label: 'Connects at startup; /readyz pings it',
    status: 'verified',
    evidence: [
      'backend/services/billing/src/index.ts#(module)',
      'backend/services/billing/src/index.ts#app',
      'backend/shared/src/mongo.ts#connectMongo',
      'backend/shared/src/mongo.ts#pingMongo',
    ],
  },

  // Redis: a client made at startup with createRedis, checked by /readyz with pingRedis.
  {
    from: 'gateway',
    to: 'redis',
    kind: 'data',
    label:
      'Opens a client at startup; /readyz sends PING. Each request is counted for the rate limits, and its session cookie is looked up (which renews the session)',
    status: 'verified',
    evidence: [
      'backend/gateway/src/index.ts#redis',
      'backend/gateway/src/index.ts#app',
      'backend/shared/src/redis.ts#createRedis',
      'backend/shared/src/redis.ts#pingRedis',
      'backend/gateway/src/guards.ts#ipRateLimit',
      'backend/gateway/src/guards.ts#userRateLimit',
      'backend/gateway/src/guards.ts#sessionLookup',
      'backend/shared/src/rateLimit.ts#hitRateLimit',
      'backend/shared/src/sessions.ts#resolveSession',
    ],
  },
  {
    from: 'auth',
    to: 'redis',
    kind: 'data',
    label:
      'Opens a client at startup; /readyz sends PING. Sign-in writes session keys and logout deletes them',
    status: 'verified',
    evidence: [
      'backend/services/auth/src/index.ts#redis',
      'backend/services/auth/src/index.ts#app',
      'backend/shared/src/redis.ts#createRedis',
      'backend/shared/src/redis.ts#pingRedis',
      'backend/services/auth/src/session-routes.ts#sessionRouter',
      'backend/shared/src/sessions.ts#createSession',
      'backend/shared/src/sessions.ts#deleteSession',
    ],
  },
  {
    from: 'agent',
    to: 'redis',
    kind: 'data',
    label: 'Opens a client at startup; /readyz sends PING. No keys are read or written yet',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/index.ts#redis',
      'backend/services/agent/src/index.ts#app',
      'backend/shared/src/redis.ts#createRedis',
      'backend/shared/src/redis.ts#pingRedis',
    ],
  },

  // Firebase: auth checks Google sign-in tokens with the Firebase Admin SDK.
  {
    from: 'auth',
    to: 'firebase',
    kind: 'external',
    label:
      'Checks Google sign-in tokens with the Firebase Admin SDK, including revocation, when the FIREBASE_* settings are set',
    status: 'verified',
    evidence: [
      'backend/services/auth/src/index.ts#verifyIdToken',
      'backend/services/auth/src/firebase.ts#createFirebaseVerifier',
      'backend/services/auth/src/firebase.ts#verifierFrom',
      'backend/services/auth/src/session-routes.ts#sessionRouter',
    ],
  },

  // Gateway → auth: the public sign-in, logout and /me routes, forwarded with a signed token.
  {
    from: 'gateway',
    to: 'auth',
    kind: 'http',
    label:
      'Sign-in, logout and /me requests from the route table, each with a fresh internal token for auth; the session cookie goes along, and Set-Cookie comes back',
    status: 'verified',
    evidence: [
      'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
      'backend/gateway/src/app.ts#createApp',
      'backend/gateway/src/proxy.ts#proxyToService',
      'backend/shared/src/internalToken.ts#signInternalToken',
      'backend/gateway/src/index.ts#app',
    ],
  },

  // -------------------------------------------------------------------------------------------
  // Planned: not built yet

  {
    from: 'browser',
    to: 'firebase',
    kind: 'external',
    label: 'Google sign-in popup, which returns the Firebase ID token',
    status: 'verified',
    evidence: ['frontend/src/lib/firebase-client.ts#signInWithGooglePopup'],
  },
  {
    from: 'frontend',
    to: 'gateway',
    kind: 'http',
    label:
      'Every /api/* call, forwarded by the Next.js server, plus /api/me from server components',
    status: 'verified',
    evidence: [
      'frontend/src/server/gateway-proxy.ts#forwardToGateway',
      'frontend/src/app/api/[...path]/route.ts#handler',
      'frontend/src/server/session.ts#fetchCurrentUser',
    ],
  },
  {
    from: 'gateway',
    to: 'chat',
    kind: 'http',
    label: 'Chat requests, each with a short-lived signed internal token',
    status: 'planned',
    plannedIn: 'Chats',
  },
  {
    from: 'gateway',
    to: 'billing',
    kind: 'http',
    label: 'Billing requests, each with a short-lived signed internal token',
    status: 'planned',
    plannedIn: 'Credits',
  },
  {
    from: 'gateway',
    to: 'agent',
    kind: 'http',
    label: 'Agent requests, each with a short-lived signed internal token',
    status: 'planned',
    plannedIn: 'AI answers',
  },
  {
    from: 'agent',
    to: 'chat',
    kind: 'http',
    label: "Service-to-service calls (CHAT_SERVICE_URL is already in the agent's .env.example)",
    status: 'planned',
    plannedIn: 'AI answers',
  },
  {
    from: 'agent',
    to: 'billing',
    kind: 'http',
    label: "Service-to-service calls (BILLING_SERVICE_URL is already in the agent's .env.example)",
    status: 'planned',
    plannedIn: 'AI answers',
  },
  {
    from: 'agent',
    to: 'llm-providers',
    kind: 'external',
    label: 'Language model calls',
    status: 'planned',
    plannedIn: 'AI answers',
  },
  {
    from: 'agent',
    to: 'tavily',
    kind: 'external',
    label: 'Web search queries',
    status: 'planned',
    plannedIn: 'Web search and code',
  },
  {
    from: 'agent',
    to: 'qdrant',
    kind: 'data',
    label: "Vector storage and search (QDRANT_URL is already in the agent's .env.example)",
    status: 'planned',
    plannedIn: 'PDF and image Q&A',
  },
  {
    from: 'agent',
    to: 's3',
    kind: 'data',
    label: 'Stores and reads files',
    status: 'planned',
    plannedIn: 'PDF and image Q&A',
  },
  {
    from: 'agent',
    to: 'pollinations',
    kind: 'external',
    label: 'Image generation requests',
    status: 'planned',
    plannedIn: 'File generation',
  },
  {
    from: 'billing',
    to: 'razorpay',
    kind: 'external',
    label: 'Payments for plans (test mode); Razorpay sends the results back by webhook',
    status: 'planned',
    plannedIn: 'Payments and usage',
  },
];

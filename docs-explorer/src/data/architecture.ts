import type { ArchComponent, ArchLink } from './schema.ts';

/**
 * The system map: every app, data store and outside service, and how they connect.
 *
 * Today only the skeleton is built: five backend apps that answer health checks, a starter
 * frontend page, and local MongoDB, Redis and Qdrant in Docker. Everything else is marked
 * `planned`, with the roadmap feature that adds it.
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
      "The user's web browser. Today it can only load the frontend's starter page. Planned: Google sign-in with Firebase and /api/* calls through the frontend (both part of Sign-in page and app shell).",
    responsibilities: [
      'Loads the frontend starter page from port 3000.',
      'Makes no API calls yet: the page is static content and links to outside sites.',
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend (Next.js)',
    kind: 'app',
    status: 'verified',
    summary:
      'The Next.js app the user opens. Today it is only the create-next-app starter page. Planned: its server proxies /api/* calls to the gateway, so secrets never reach the browser (Sign-in page and app shell).',
    responsibilities: [
      'Serves the starter page (Home) inside the root layout (RootLayout).',
      'Makes no API calls yet. Its .env.example already lists GATEWAY_URL, but no code reads it.',
    ],
    path: 'frontend',
    port: 3000,
    entryPoints: ['frontend/src/app/page.tsx#Home', 'frontend/src/app/layout.tsx#RootLayout'],
  },
  {
    id: 'gateway',
    name: 'Gateway',
    kind: 'app',
    status: 'verified',
    summary:
      'Planned to be the one public door into the backend: it will check sessions and rate limits, then forward each call to a service with a short-lived signed internal token (from Sign-in and sessions). Today it only serves the shared health checks, and it is not the only way in: every service listens on all network interfaces and none checks an internal token, so each one can be reached directly.',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware plus GET /healthz and GET /readyz. It has no routes of its own yet.',
      'Opens a Redis client at startup. /readyz says ready only when Redis answers PING.',
      'Checks its settings at startup and refuses to start if a required variable (REDIS_URL) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults.',
      'On SIGTERM or SIGINT, finishes in-flight requests and then closes the Redis client, unless Ctrl+C under pnpm dev kills it first.',
    ],
    path: 'backend/gateway',
    port: 8000,
    entryPoints: ['backend/gateway/src/index.ts#(module)', 'backend/gateway/src/app.ts#createApp'],
  },
  {
    id: 'auth',
    name: 'Auth service',
    kind: 'app',
    status: 'verified',
    summary:
      'Will handle sign-in. Today it only answers health checks. Planned: check Google sign-in tokens from Firebase (Sign-in and sessions).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware plus GET /healthz and GET /readyz. It has no routes of its own yet.',
      'Connects to MongoDB at startup and does not start serving until the connection works.',
      'Opens a Redis client at startup. /readyz says ready only when both MongoDB and Redis answer.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI, REDIS_URL) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults.',
      'On SIGTERM or SIGINT, finishes in-flight requests, then disconnects MongoDB and closes Redis, unless Ctrl+C under pnpm dev kills it first.',
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
      'Will own chats and their messages. Today it only answers health checks. Planned: its chat routes, reached through the gateway (Chats).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware plus GET /healthz and GET /readyz. It has no routes of its own yet.',
      'Connects to MongoDB at startup and does not start serving until the connection works. /readyz pings it.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults.',
      'On SIGTERM or SIGINT, finishes in-flight requests and then disconnects MongoDB, unless Ctrl+C under pnpm dev kills it first.',
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
      'Will run the AI agents. Today it only answers health checks. Planned: LLM calls through Groq, OpenRouter and Gemini (AI answers), web search with Tavily (Web search and code), files in S3 and vectors in Qdrant (PDF and image Q&A), and images from Pollinations (File generation).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware plus GET /healthz and GET /readyz. It has no routes of its own yet.',
      'Connects to MongoDB at startup and does not start serving until the connection works.',
      'Opens a Redis client at startup. /readyz says ready only when both MongoDB and Redis answer.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI, REDIS_URL) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults. Its .env.example also lists QDRANT_URL, CHAT_SERVICE_URL and BILLING_SERVICE_URL for later features, but env.ts does not read them yet.',
      'On SIGTERM or SIGINT, finishes in-flight requests, then disconnects MongoDB and closes Redis, unless Ctrl+C under pnpm dev kills it first.',
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
      'Will own credits and payments. Today it only answers health checks. Planned: its routes (Credits), with credits kept in a ledger, and Razorpay payments (Payments and usage).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware plus GET /healthz and GET /readyz. It has no routes of its own yet.',
      'Connects to MongoDB at startup and does not start serving until the connection works. /readyz pings it.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults.',
      'On SIGTERM or SIGINT, finishes in-flight requests and then disconnects MongoDB, unless Ctrl+C under pnpm dev kills it first.',
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
      "createService builds an Express app with the middleware in a fixed order: request ID, request logging, security headers (helmet), JSON body (64kb by default), /healthz and /readyz, the app's routes, then 404 and error handling.",
      "startService opens the port and shuts down cleanly on SIGTERM or SIGINT: stop taking new connections, wait up to 10 seconds for in-flight requests, then run the app's cleanup. Under pnpm dev, one Ctrl+C sends SIGINT twice, and the second kills the app before that cleanup finishes.",
      "loadEnv checks each app's settings at startup and lists every problem at once, without printing the values.",
      'createLogger makes a pino logger that hides secrets such as tokens, cookies and passwords.',
      'connectMongo, pingMongo, createRedis and pingRedis open the database connections and provide the checks behind /readyz.',
      'Built and tested, but not used by any app yet: the internal-token helpers (signInternalToken, requireInternalToken), the validate request middleware, and shared constants such as agents, credit costs, rate limits and plans.',
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
      'No app stores anything in it yet: there are no models or routes.',
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
      'A fast key-value store, run locally in Docker (redis:7-alpine). Set up so keys are never dropped silently, because sessions will live here.',
    responsibilities: [
      'Listens on host port 6380, not the usual 6379. It saves to disk (append-only file) in the redis-data volume.',
      'Sets the noeviction policy, so if a memory limit is added later, Redis will refuse new writes instead of quietly deleting keys. No memory limit (--maxmemory) is set today, so the policy does not come into play yet.',
      'gateway, auth and agent open a client at startup and send PING for /readyz. Nothing reads or writes keys yet.',
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
  // Outside services (none is called by the code yet)

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
    status: 'planned',
    plannedIn: 'Sign-in and sessions',
    summary:
      "Google sign-in. Auth will check Google sign-in tokens against Firebase's public keys (Sign-in and sessions), and the browser will sign in with Firebase (Sign-in page and app shell). Not built yet.",
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
    label: 'Page loads: today only the starter page at /',
    status: 'verified',
    evidence: ['frontend/src/app/page.tsx#Home', 'frontend/src/app/layout.tsx#RootLayout'],
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
    label: 'Opens a client at startup; /readyz sends PING. No keys are read or written yet',
    status: 'verified',
    evidence: [
      'backend/gateway/src/index.ts#redis',
      'backend/gateway/src/index.ts#app',
      'backend/shared/src/redis.ts#createRedis',
      'backend/shared/src/redis.ts#pingRedis',
    ],
  },
  {
    from: 'auth',
    to: 'redis',
    kind: 'data',
    label: 'Opens a client at startup; /readyz sends PING. No keys are read or written yet',
    status: 'verified',
    evidence: [
      'backend/services/auth/src/index.ts#redis',
      'backend/services/auth/src/index.ts#app',
      'backend/shared/src/redis.ts#createRedis',
      'backend/shared/src/redis.ts#pingRedis',
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

  // -------------------------------------------------------------------------------------------
  // Planned: not built yet

  {
    from: 'browser',
    to: 'firebase',
    kind: 'external',
    label: 'Google sign-in',
    status: 'planned',
    plannedIn: 'Sign-in page and app shell',
  },
  {
    from: 'frontend',
    to: 'gateway',
    kind: 'http',
    label: 'Every /api/* call, forwarded by the Next.js server so secrets stay off the browser',
    status: 'planned',
    plannedIn: 'Sign-in page and app shell',
  },
  {
    from: 'gateway',
    to: 'auth',
    kind: 'http',
    label: 'Auth requests, each with a short-lived signed internal token',
    status: 'planned',
    plannedIn: 'Sign-in and sessions',
  },
  {
    from: 'auth',
    to: 'firebase',
    kind: 'external',
    label: "Fetches Firebase's public keys to check Google sign-in tokens",
    status: 'planned',
    plannedIn: 'Sign-in and sessions',
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

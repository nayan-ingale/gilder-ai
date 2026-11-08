import type { ArchComponent, ArchLink } from './schema.ts';

/**
 * The system map: every app, data store and outside service, and how they connect.
 *
 * Built today: the frontend (sign-in page, app shell, chat list, search, chat page and credits
 * card) and its /api proxy; the gateway, which checks each /api request and forwards the sign-in,
 * logout, profile, chat and balance routes; auth, chat and billing, which serve them; auth's call
 * to billing for the sign-up grant; the agent's turn route, which calls chat, billing and the AI
 * providers but is not forwarded by the gateway yet; and local MongoDB, Redis and Qdrant in
 * Docker. Everything else is marked `planned`, with the roadmap feature that adds it.
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
      'Loads the pages from the frontend on port 3000: /login, and the signed-in app at / (a new chat) and /c/<chat ID>, which the login gate sends to /login when there is no session cookie.',
      "Calls /api/* on the frontend itself: the chat list, search, rename, pin and delete through RTK Query (the store's api), and sign-in and the account through apiFetch, which turns problem+json errors into ApiError with the code and request ID.",
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
      'The Next.js app the user opens. Its server forwards every /api/* call to the gateway, so backend addresses and secrets never reach the browser. It has the sign-in page, the signed-in app shell with the chat list and search, and a page for each chat.',
    responsibilities: [
      'Forwards /api/* to GATEWAY_URL (forwardToGateway, in the api/[...path] route): it passes the cookie, Origin and forwarded address, adds a request ID and x-gilder-client: web, streams the answer and its Set-Cookie headers back, answers 503 when the gateway is down, and cancels the call when the browser goes away.',
      'Login gate (proxy.ts): a visitor without a session cookie who opens /, /c/... or /settings/... goes to /login.',
      'Sign-in page (/login): Google sign-in through a Firebase popup, disabled until the NEXT_PUBLIC_FIREBASE_* settings are set, and dev sign-in by email in development builds only.',
      "App shell (the (app) layout): a sidebar (a top bar on small screens) with New chat, Search chats, the chat list and the account menu (theme, sign out). Server components confirm the session with the gateway's /api/me (getCurrentUser) inside a Suspense boundary, so the shell is prerendered.",
      'Chat list (ChatList): loaded in the browser with RTK Query a page at a time and grouped into Pinned, Today, Previous 7 days and Older. Each row has a menu to rename, pin or delete, which changes the list at once and undoes it if the call fails. On small screens the same list opens in a panel (MobileNav).',
      'Search (SearchDialog, ⌘K or Ctrl+K): searches titles and message text through GET /api/chats?query=, with the keyboard. ⌘⇧O or Ctrl+Shift+O goes to / for a new chat (ChatCommands).',
      "Chat page (/c/<chat ID>): the server reads the chat and its latest messages from the gateway with the browser's cookie (getChatWithHistory, gatewayGet) and renders them, so the history shows on first paint. A missing, deleted or someone else's chat gets one 'This chat isn't available' page.",
      'Credits card (CreditsCard): the balance and plan from GET /api/billing/account, in the sidebar and the small-screen panel, with a warning below 10 credits.',
      'Data in the browser: a Redux store with RTK Query (makeStore, StoreProvider), whose calls all go to /api.',
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
      'frontend/src/store/api.ts#api',
      'frontend/src/app/(app)/c/[chatId]/page.tsx#ChatPage',
    ],
  },
  {
    id: 'gateway',
    name: 'Gateway',
    kind: 'app',
    status: 'verified',
    summary:
      "The one public entry to the backend. Each /api request goes through its checks (rate limits, the route allowlist, the origin check and the session lookup) and is then forwarded to its service with a fresh signed internal token. Its route table lists the auth and chat routes and billing's account route so far; nothing reaches the agent through it yet. The services also listen on their own ports, but each one answers 401 to anything without a valid token except its health checks.",
    responsibilities: [
      "Builds its Express app with createService, with parseJson: false and its /api router as its routes, after the shared middleware and GET /healthz and GET /readyz. Express's trust proxy is set to TRUST_PROXY_HOPS, so req.ip is the client's address.",
      'Limits each IP address to 120 requests a minute (ipRateLimit), for every request that reaches the router, and each signed-in user to 60 (userRateLimit). Over the limit is a 429 with Retry-After.',
      "Forwards only what its route table (PUBLIC_ROUTES) lists: POST /api/auth/session, POST /api/auth/dev-session, DELETE /api/auth/session, and GET and PATCH /api/me to auth; GET and POST /api/chats, GET, PATCH and DELETE /api/chats/:id and GET /api/chats/:id/messages to chat; GET /api/billing/account to billing. A :id must be 1 to 64 letters, digits, - or _. Anything else gets the gateway's own 404 and never reaches a service.",
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
      "Handles sign-in, logout and the user's profile. Its session and /me routes sit behind the internal-token check, so a direct call to any path except the health checks gets 401. The gateway forwards the public sign-in, logout and /me routes to it, each with a token it signs. On every sign-in it asks billing for the sign-up credits, with its own key.",
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (the internalAuth option, audience auth) in front of its own routes. A call without a valid token gets 401 on any path except the health checks; an unknown path with a valid token gets 404.',
      'Connects to MongoDB at startup and does not start serving until the connection works.',
      'Opens a Redis client at startup. /readyz says ready only when both MongoDB and Redis answer.',
      'Imports INTERNAL_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      "Is reached through the gateway's route table: POST /api/auth/session → POST /sessions, POST /api/auth/dev-session → POST /sessions/dev, DELETE /api/auth/session → DELETE /sessions/current, GET and PATCH /api/me → /me. GET /internal/users/:id has no public route.",
      'Serves the sign-in routes (sessionRouter): POST /sessions for Google, POST /sessions/dev only when AUTH_DEV_LOGIN is on (otherwise the path is a 404), and DELETE /sessions/current for logout. They create or delete the session in Redis and set or clear the gilder_sid cookie, marked Secure when NODE_ENV is production.',
      'Asks billing for the sign-up grant on every sign-in (billingSignupGrant): POST /internal/accounts through an internal client signed with its own SERVICE_PRIVATE_KEY, with one retry. Billing grants once per user; if billing is down, the sign-in still succeeds, a warning is logged and the next sign-in asks again.',
      "Serves the profile routes (meRouter): GET /me, PATCH /me to change the theme, and GET /internal/users/:id, which returns only the token's own user.",
      'Keeps users in MongoDB (UserModel, with a unique Firebase ID and a unique lowercase email); toProfile is the public shape of a user.',
      "Checks Google sign-in tokens with the Firebase Admin SDK (createFirebaseVerifier) when all three FIREBASE_* settings are set, including whether a token was revoked. A bad token gives 401, and a server-side failure stays a 500. Without the settings it uses googleSignInNotSetUp, so Google sign-in answers 503, and startup logs the warning 'Google sign-in is not set up: the FIREBASE_* settings are empty'.",
      "With AUTH_DEV_LOGIN on, startup logs the warning 'dev sign-in is on: anyone who can reach auth can sign in with just an email'.",
      'Checks its settings at startup (rules in env-schema.ts) and refuses to start if a required variable (MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY, SERVICE_PRIVATE_KEY) is missing, or if any value is invalid. INTERNAL_PUBLIC_KEY (the shared internalPublicKeySchema; escaped \\n line breaks are fine) must start with -----BEGIN PUBLIC KEY-----, and SERVICE_PRIVATE_KEY must parse as an Ed25519 private key; the messages say to run pnpm setup:keys and never repeat the value. PORT, NODE_ENV, LOG_LEVEL, BILLING_SERVICE_URL (http://localhost:8004) and AUTH_DEV_LOGIN (false) have defaults.',
      'In production it also refuses AUTH_DEV_LOGIN=true and requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY; elsewhere the three are optional, but all three or none.',
      'On SIGTERM or SIGINT, finishes in-flight requests, then disconnects MongoDB and closes Redis.',
    ],
    path: 'backend/services/auth',
    port: 8001,
    entryPoints: [
      'backend/services/auth/src/index.ts#(module)',
      'backend/services/auth/src/app.ts#createApp',
      'backend/services/auth/src/session-routes.ts#sessionRouter',
      'backend/services/auth/src/billing.ts#billingSignupGrant',
    ],
  },
  {
    id: 'chat',
    name: 'Chat service',
    kind: 'app',
    status: 'verified',
    summary:
      "Owns chats and their messages, in its own database. The gateway forwards the six /api/chats routes to it: list and search, create, read, rename or pin, delete, and the history. Its /internal routes are open only to the agent, which reads chats and saves messages while it answers. Every lookup filters by the user in the internal token, so another user's chat gets the same 404 as a missing one.",
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience chat; it trusts the gateway and the agent) in front of chatRouter and internalRouter. A call without a valid token gets 401 on any path except the health checks.',
      'Serves the chat routes (chatRouter): GET /chats (every pinned chat on the first page, then the others by latest activity, with a keyset cursor; or a search of titles and message text with ?query=), POST /chats, GET, PATCH (rename or pin) and DELETE (soft) /chats/:id, and GET /chats/:id/messages (pages from the newest back).',
      "Serves the internal routes (internalRouter) for the agent service: read a chat, auto-title it while it is still 'New chat', read its recent finished messages, save a message once per clientMessageId, and fill in an answer. Only tokens signed with the agent's key may use them (requireCaller), and the gateway has no route to them.",
      'Keeps conversations and messages in MongoDB (ConversationModel, MessageModel). findOwnedConversation reads a chat only for its owner and only if it is not deleted, and toChat and toMessage are the public shapes.',
      'Connects to MongoDB at startup and does not start serving until the connection works. /readyz pings it.',
      'Imports INTERNAL_PUBLIC_KEY and AGENT_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI, INTERNAL_PUBLIC_KEY, AGENT_PUBLIC_KEY) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults.',
      'On SIGTERM or SIGINT, finishes in-flight requests and then disconnects MongoDB.',
    ],
    path: 'backend/services/chat',
    port: 8002,
    entryPoints: [
      'backend/services/chat/src/index.ts#(module)',
      'backend/services/chat/src/app.ts#createApp',
      'backend/services/chat/src/chat-routes.ts#chatRouter',
      'backend/services/chat/src/internal-routes.ts#internalRouter',
      'backend/services/chat/src/models.ts#findOwnedConversation',
    ],
  },
  {
    id: 'agent',
    name: 'Agent service',
    kind: 'app',
    status: 'verified',
    summary:
      'Runs a turn: POST /chats/:chatId/turns checks the chat and the credits, picks the agent, holds the credits in billing, saves the messages in chat and streams the answer from an AI provider as server-sent events, then charges or releases the credits. Only the chat agent runs so far, and the gateway does not forward the turn route yet. Planned: web search with Tavily (Web search and code), files in S3 and vectors in Qdrant (PDF and image Q&A), and images from Pollinations (File generation).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience agent; only the gateway is trusted) in front of turnRouter.',
      "Serves POST /chats/:chatId/turns (turnRouter): 404 for someone else's chat, 409 for a message already being answered, 402 before any AI call when the user has no credits (SEC-03), then memory, routing, a credit hold, the two messages in chat, and the streamed answer (meta, agent, token, usage, title, error and done events). A finished answer is committed; a failure, or a stop before the first token, is released; a stop after text started is committed.",
      "Calls chat and billing with its own key (SERVICE_PRIVATE_KEY) through createInternalClient: chat's /internal routes to read the chat and its recent messages, save and fill in messages and name a new chat; billing's GET /account and /internal/credits/reserve, commit and release.",
      'Calls the AI providers through its own fetch-based layer (createLlm, createOpenAiCompatibleProvider): Groq, OpenRouter and Gemini over their OpenAI-compatible APIs, with a fallback to the next model only before the first token, a 20-second start limit and a 30-second idle limit. LLM_MODE=mock (the default) answers from a mock provider with no keys.',
      'Picks the agent (routeMessage): a chip or /shortcut, an attachment, or a small router model asked for JSON (completeJson, with one repair); anything unclear becomes chat. Titles a new chat while the answer streams (generateTitle).',
      "Keeps each chat's last 20 messages in Redis for an hour (createMemory), and a 15-minute lock per message (turn-lock:...).",
      'Connects to MongoDB at startup and does not start serving until the connection works.',
      'Opens a Redis client at startup. /readyz says ready only when both MongoDB and Redis answer.',
      'Checks its settings at startup (rules in env-schema.ts) and refuses to start if a required variable (MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY, SERVICE_PRIVATE_KEY) is missing, if any value is invalid, or if LLM_MODE is live without GROQ_API_KEY. Its .env.example also lists QDRANT_URL, TAVILY_API_KEY and the S3 settings for later features, which the schema does not read yet.',
      'On SIGTERM or SIGINT, finishes in-flight requests, then disconnects MongoDB and closes Redis.',
    ],
    path: 'backend/services/agent',
    port: 8003,
    entryPoints: [
      'backend/services/agent/src/index.ts#(module)',
      'backend/services/agent/src/app.ts#createApp',
      'backend/services/agent/src/turns.ts#turnRouter',
      'backend/services/agent/src/llm/llm.ts#createLlm',
    ],
  },
  {
    id: 'billing',
    name: 'Billing service',
    kind: 'app',
    status: 'verified',
    summary:
      'Owns credits: one account per user with its plan and balance, a hold for each answer in progress, and an append-only ledger. The gateway forwards GET /api/billing/account to it; auth calls it for the sign-up grant and the agent to hold, charge and release credits, each with its own key. Planned: Razorpay payments (Payments and usage).',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience billing; it trusts the gateway, auth and the agent) in front of accountRouter and internalRouter.',
      "Serves GET /account (the plan and balance, for the credits card and the agent's balance check) and the internal routes: POST /internal/accounts for auth only, and POST /internal/credits/reserve, commit and release for the agent only (requireCaller). Other signers get 403.",
      'Grants 100 sign-up credits once per user (grantSignupCredits), even when sign-ins race.',
      "Holds an answer's credits with one conditional update on balance >= cost, so parallel answers can never overdraw (reserveCredits, SEC-08); the amount comes from CREDIT_COSTS. Commit appends a usage ledger entry; release gives the credits back. Each happens once, in a transaction.",
      'Keeps accounts, reservations and the ledger in MongoDB (AccountModel, ReservationModel, LedgerModel). The balance always equals the sum of the ledger minus the credits on hold, which the tests check.',
      'Releases holds still held after 10 minutes, every minute (startReservationSweeper), say after an agent crash.',
      'Connects to MongoDB at startup and does not start serving until the connection works. /readyz pings it.',
      'Imports INTERNAL_PUBLIC_KEY, AUTH_PUBLIC_KEY and AGENT_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      'Checks its settings at startup and refuses to start if a required variable (MONGODB_URI and the three public keys) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults. Its .env.example also lists the Razorpay settings for later features, which env.ts does not read yet.',
      'On SIGTERM or SIGINT, finishes in-flight requests, then stops the sweeper and disconnects MongoDB.',
    ],
    path: 'backend/services/billing',
    port: 8004,
    entryPoints: [
      'backend/services/billing/src/index.ts#(module)',
      'backend/services/billing/src/app.ts#createApp',
      'backend/services/billing/src/credits.ts#reserveCredits',
      'backend/services/billing/src/internal-routes.ts#internalRouter',
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
      "Its setup:keys script (pnpm setup:keys) writes three key pairs into the .env files, without printing them: the gateway's private key and every service's matching public key, and auth's and the agent's own private keys with their public keys for the services they call (billing for auth; chat and billing for the agent).",
      "Internal tokens: each token names its signer (INTERNAL_CALLERS: gateway, auth, agent). The gateway signs one for each forwarded request (signInternalToken); auth and the agent sign their own calls through createInternalClient, which also keeps the request ID, times out after 5 seconds, can retry once and passes the other service's error codes on. Services check every token against the keys they trust (createService's internalAuth option with callers, requireInternalToken, verifyInternalToken). Routes that act for a user add requireUser, and internal routes meant for one service add requireCaller.",
      'Sessions: auth creates and deletes them (createSession, deleteSession); the gateway looks them up on each request (sessionIdFromCookies, resolveSession).',
      "Rate limits: the gateway's per-IP and per-user limits (rateLimit, hitRateLimit, GATEWAY_RATE_LIMITS). The validate request middleware checks the params, query and bodies of the services' routes.",
      'Shared constants: chat and billing use the agent list (AGENTS), billing the credit costs, the sign-up credits and the plan names, and the agent the price of a chat answer. The per-agent rate limits are built and tested, but not used by any app yet.',
      'It re-exports mongoose, so every model uses the connection connectMongo opens: auth its users, chat its conversations and messages, billing its accounts, holds and ledger.',
      'startTestMongo gives each test file its own in-memory MongoDB, a one-member replica set when the test needs transactions.',
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
      'The main database, run locally in Docker (mongo:8). It is a single-node replica set named rs0, because MongoDB transactions need a replica set: billing changes every balance in a transaction with its ledger entry or hold.',
    responsibilities: [
      'Listens on host port 27018, not the usual 27017, so it does not clash with other local projects. Data lives in the mongo-data volume.',
      'The Docker health check creates the rs0 replica set on the first run.',
      'auth, chat, agent and billing connect at startup. Each .env.example points the app at its own database: gilder_auth, gilder_chat, gilder_agent and gilder_billing.',
      'Auth keeps its users here (a unique Firebase ID and email each): its sign-in routes create or update them, and the /me routes read and save them.',
      "Chat keeps conversations and messages in gilder_chat. The indexes serve the chat list (userId, pinnedAt, lastMessageAt), a chat's messages in order, one message per clientMessageId, and text search of titles and message text, each behind userId.",
      'Billing keeps accounts (keyed by the user ID), reservations and the ledger in gilder_billing. Partial unique indexes allow one sign-up grant per user and one usage entry per reservation; a unique idempotency key makes each reserve happen once.',
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
      'gateway, auth and agent open a client at startup and send PING for /readyz.',
      "The agent caches each chat's last 20 messages as the list mem:<chat ID> for an hour, and locks a message being answered with turn-lock:<chat ID>:<client message ID> for up to 15 minutes.",
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
  // Outside services (Firebase from auth, and the AI providers from the agent, are called today)

  {
    id: 'llm-providers',
    name: 'LLM providers (Groq, OpenRouter, Gemini)',
    kind: 'external',
    status: 'verified',
    summary:
      'The language models the agent calls to write answers, all over their OpenAI-compatible chat-completions APIs with fetch. Each is used only when its key is set and LLM_MODE is live; the default, mock, calls none of them.',
    responsibilities: [
      'Groq: the chat answers (openai/gpt-oss-120b, then openai/gpt-oss-20b), routing and titles (openai/gpt-oss-20b). Live mode needs its key.',
      'OpenRouter (deepseek/deepseek-chat) for code and Gemini (gemini-2.5-flash) for image questions are set up in MODEL_ROUTES and buildProviders, but no running agent uses them yet.',
    ],
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
      'frontend/src/app/(app)/c/[chatId]/page.tsx#ChatPage',
      'frontend/src/lib/api.ts#apiFetch',
      'frontend/src/store/api.ts#api',
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
    label:
      'Connects at startup; /readyz pings it. Reads and writes conversations and messages in gilder_chat, always filtered by the user, and soft-deletes chats',
    status: 'verified',
    evidence: [
      'backend/services/chat/src/index.ts#(module)',
      'backend/services/chat/src/index.ts#app',
      'backend/shared/src/mongo.ts#connectMongo',
      'backend/shared/src/mongo.ts#pingMongo',
      'backend/services/chat/src/models.ts#ConversationModel',
      'backend/services/chat/src/models.ts#MessageModel',
      'backend/services/chat/src/models.ts#findOwnedConversation',
      'backend/services/chat/src/chat-routes.ts#chatRouter',
      'backend/services/chat/src/internal-routes.ts#internalRouter',
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
    label:
      'Connects at startup; /readyz pings it. Keeps accounts, credit holds and the ledger in gilder_billing, changing each balance in a transaction with its ledger entry or hold',
    status: 'verified',
    evidence: [
      'backend/services/billing/src/index.ts#(module)',
      'backend/services/billing/src/index.ts#app',
      'backend/shared/src/mongo.ts#connectMongo',
      'backend/shared/src/mongo.ts#pingMongo',
      'backend/services/billing/src/models.ts#AccountModel',
      'backend/services/billing/src/models.ts#ReservationModel',
      'backend/services/billing/src/models.ts#LedgerModel',
      'backend/services/billing/src/credits.ts#inTransaction',
      'backend/services/billing/src/sweeper.ts#releaseStaleReservations',
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
    label:
      "Opens a client at startup; /readyz sends PING. Caches each chat's last 20 messages (mem:...) and locks a message while it is answered (turn-lock:...)",
    status: 'verified',
    evidence: [
      'backend/services/agent/src/index.ts#redis',
      'backend/services/agent/src/index.ts#app',
      'backend/shared/src/redis.ts#createRedis',
      'backend/shared/src/redis.ts#pingRedis',
      'backend/services/agent/src/memory.ts#createMemory',
      'backend/services/agent/src/turns.ts#turnRouter',
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

  // Gateway → chat: the six /api/chats routes, forwarded with a token that names the user.
  {
    from: 'gateway',
    to: 'chat',
    kind: 'http',
    label:
      'Chat list, search, create, read, rename or pin, delete and history requests from the route table, each with a fresh internal token for chat that names the user; no cookie goes along',
    status: 'verified',
    evidence: [
      'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
      'backend/gateway/src/app.ts#createApp',
      'backend/gateway/src/proxy.ts#proxyToService',
      'backend/shared/src/internalToken.ts#signInternalToken',
      'backend/services/chat/src/chat-routes.ts#chatRouter',
    ],
  },

  // The frontend: the browser's Google popup, and the Next.js server's calls to the gateway.
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
      'Every /api/* call, forwarded by the Next.js server, plus /api/me and a chat with its messages from server components',
    status: 'verified',
    evidence: [
      'frontend/src/server/gateway-proxy.ts#forwardToGateway',
      'frontend/src/app/api/[...path]/route.ts#handler',
      'frontend/src/server/gateway-fetch.ts#gatewayGet',
      'frontend/src/server/session.ts#fetchCurrentUser',
      'frontend/src/server/chats.ts#loadChatWithHistory',
    ],
  },

  // Gateway → billing: the balance for the credits card.
  {
    from: 'gateway',
    to: 'billing',
    kind: 'http',
    label:
      'GET /api/billing/account (the plan and balance), with a fresh internal token for billing that names the user',
    status: 'verified',
    evidence: [
      'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
      'backend/gateway/src/proxy.ts#proxyToService',
      'backend/services/billing/src/account-routes.ts#accountRouter',
    ],
  },

  // Service to service: each caller signs with its own key, and the receiver checks the caller.
  {
    from: 'auth',
    to: 'billing',
    kind: 'http',
    label:
      "The sign-up grant on every sign-in (POST /internal/accounts), signed with auth's own key; a billing outage never blocks the sign-in",
    status: 'verified',
    evidence: [
      'backend/services/auth/src/billing.ts#billingSignupGrant',
      'backend/shared/src/internalClient.ts#createInternalClient',
      'backend/services/auth/src/session-routes.ts#sessionRouter',
      'backend/services/billing/src/internal-routes.ts#internalRouter',
    ],
  },
  {
    from: 'agent',
    to: 'chat',
    kind: 'http',
    label:
      "During a turn: reads the chat and its recent messages, saves the user's message and the answer, fills the answer in and names a new chat, through chat's /internal routes with the agent's own key",
    status: 'verified',
    evidence: [
      'backend/services/agent/src/services.ts#chatService',
      'backend/shared/src/internalClient.ts#createInternalClient',
      'backend/services/agent/src/turns.ts#turnRouter',
      'backend/services/chat/src/internal-routes.ts#internalRouter',
    ],
  },
  {
    from: 'agent',
    to: 'billing',
    kind: 'http',
    label:
      "During a turn: reads the balance, holds the answer's credits, then commits or releases them, with the agent's own key",
    status: 'verified',
    evidence: [
      'backend/services/agent/src/services.ts#billingService',
      'backend/shared/src/internalClient.ts#createInternalClient',
      'backend/services/agent/src/turns.ts#turnRouter',
      'backend/services/billing/src/internal-routes.ts#internalRouter',
    ],
  },
  {
    from: 'agent',
    to: 'llm-providers',
    kind: 'external',
    label:
      'Streams answers, routing and titles from Groq (and OpenRouter or Gemini when their keys are set) over their OpenAI-compatible APIs, in live mode only',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/llm/openai-compatible.ts#createOpenAiCompatibleProvider',
      'backend/services/agent/src/llm/providers.ts#buildProviders',
      'backend/services/agent/src/llm/llm.ts#createLlm',
      'backend/services/agent/src/llm/models.ts#MODEL_ROUTES',
    ],
  },

  // -------------------------------------------------------------------------------------------
  // Planned: not built yet

  {
    from: 'gateway',
    to: 'agent',
    kind: 'http',
    label:
      "Turn requests (POST /chats/:chatId/turns), each with a short-lived signed internal token: the agent serves the route, but the gateway's route table does not list it yet",
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

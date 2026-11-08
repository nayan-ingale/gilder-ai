import type { ArchComponent, ArchLink } from './schema.ts';

/**
 * The system map: every app, data store and outside service, and how they connect.
 *
 * Built today: the frontend (sign-in page, app shell, chat list, search, the chat thread with
 * streamed answers, attachments and generated files, the credits card, and the billing and usage
 * pages) and its /api proxy; the
 * gateway, which checks each /api request and forwards the sign-in, logout, profile, chat,
 * answer, file, balance, payment and usage routes and Razorpay's webhook; auth, chat, billing and
 * the agent, which serve them; auth's call to billing for the sign-up grant; the agent's calls to
 * chat, billing, the AI providers, Tavily, Pollinations, S3 and Qdrant; billing's calls to
 * Razorpay; the browser's uploads and downloads straight to S3; and local MongoDB, Redis and
 * Qdrant in Docker. Anything not built yet would be marked `planned`, with the roadmap feature
 * that adds it.
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
      "Calls /api/* on the frontend itself: the chat list, search, rename, pin, delete, the balance, the plans, payments and usage through RTK Query (the store's api); sign-in and the account through apiFetch, which turns problem+json errors into ApiError with the code and request ID; and answers through streamTurn, which posts a message and reads the server-sent events as they arrive.",
      'Keeps the HttpOnly session cookie, which page scripts cannot read, and a gilder_theme cookie for the theme.',
      'Google sign-in opens a Firebase popup and sends the ID token to /api/auth/session.',
      "Buying credits opens Razorpay's checkout window (checkout.js, loaded only then): card and UPI details go to Razorpay, never to the app.",
      'Uploads attached files straight to S3 with the signed form the agent returns, and shows generated images and opens downloads from short-lived signed links.',
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend (Next.js)',
    kind: 'app',
    status: 'verified',
    summary:
      'The Next.js app the user opens. Its server forwards every /api/* call to the gateway, so backend addresses and secrets never reach the browser. It has the sign-in page, the signed-in app shell with the chat list and search, a page for each chat, and the billing and usage pages.',
    responsibilities: [
      'Forwards /api/* to GATEWAY_URL (forwardToGateway, in the api/[...path] route): it passes the cookie, Origin and forwarded address (and, for the payment webhook, x-razorpay-signature and x-razorpay-event-id), adds a request ID and x-gilder-client: web, streams the answer and its Set-Cookie headers back, answers 503 when the gateway is down, and cancels the call when the browser goes away.',
      'Login gate (proxy.ts): a visitor without a session cookie who opens /, /c/... or /settings/... goes to /login.',
      'Sign-in page (/login): Google sign-in through a Firebase popup, disabled until the NEXT_PUBLIC_FIREBASE_* settings are set, and dev sign-in by email in development builds only.',
      "App shell (the (app) layout): a sidebar (a top bar on small screens) with New chat, Search chats, the chat list and the account menu (theme, Billing and credits, Usage, sign out). Server components confirm the session with the gateway's /api/me (getCurrentUser) inside a Suspense boundary, so the shell is prerendered.",
      'Chat list (ChatList): loaded in the browser with RTK Query a page at a time and grouped into Pinned, Today, Previous 7 days and Older. Each row has a menu to rename, pin or delete, which changes the list at once and undoes it if the call fails. On small screens the same list opens in a panel (MobileNav).',
      'Search (SearchDialog, ⌘K or Ctrl+K): searches titles and message text through GET /api/chats?query=, with the keyboard. ⌘⇧O or Ctrl+Shift+O goes to / for a new chat (ChatCommands).',
      "Chat page (/c/<chat ID>): the server reads the chat and its latest messages from the gateway with the browser's cookie (getChatWithHistory, gatewayGet) and renders them in the chat thread, so the history shows on first paint. A missing, deleted or someone else's chat gets one 'This chat isn't available' page.",
      'Chat thread (ChatThread, useChatThread): the conversation and the composer. A sent message shows at once, and the answer fills in token by token from the stream; a refusal puts the thread back and says why. Stop (or Esc), Regenerate on the latest answer, Edit on the latest message (or ↑), copy on every message. Attached files are uploaded as soon as they are picked (uploadFile), and a PDF is then polled every 2 seconds until it has been read.',
      'Composer: Enter to send, a paperclip to attach PDFs and images (a chip per file, and Send waits until all are ready; in a chat, not on the new-chat page), an agent menu (Auto, Chat, Search, Code, PDF, Slides, Image), / shortcut hints, and an out-of-credits state. On / it is the new-chat composer: the first message creates the chat, queues the message (the pending slice) and opens the chat, which sends it.',
      'Answers render as safe Markdown (react-markdown and remark-gfm): raw HTML is shown as text, images become links (SEC-10), code blocks are highlighted (highlight.js) with a copy button, and search citations link to their sources.',
      'Code answers get a files card and a side panel: highlighted read-only files, copy, downloads and a zip (fflate), and a preview in a sandboxed frame whose page cannot reach the network.',
      "Answers with files: a chip per attached file on the user's message, 'From your documents' with the cited pages under a PDF answer, a progress bar while a file is made, and the generated files (GeneratedFiles): an image shown from a fresh link, or a download card for a PDF or deck.",
      "Credits card (CreditsCard): the balance and plan from GET /api/billing/account, in the sidebar and the small-screen panel, with a warning below 10 credits and a 'Get more' link to the billing page.",
      "Billing page (/settings/billing, BillingView): a note that only test payments are taken, the current plan and balance, the Starter and Pro plans priced in rupees, and the payment history. Buy asks billing for an order, opens Razorpay's checkout (openCheckout) and sends the signed result back to billing to check.",
      "Usage page (/settings/usage, UsageView): credits and answers over the last 30 days, a column chart per day counted in the viewer's time zone (DailyChart), a bar per agent and the latest answers with their tokens and time. A finished answer invalidates its data.",
      "Data in the browser: a Redux store with RTK Query (makeStore, StoreProvider), whose calls all go to /api. Server components' calls to the gateway (gatewayGet) pass on the visitor's x-forwarded-for, so the gateway counts each visitor, not the Next.js server.",
      'Accessibility: <main> is focusable with a focus ring, so keyboard users can scroll it, and the message list holds only list items. axe checks the main pages in the end-to-end tests.',
      'Design system: Light minimal tokens in light and dark (with --chart-bar for chart columns), Radix-based components, and a theme remembered in a cookie and applied before the first paint.',
      "Health for uptime monitors: GET /api/health (siteHealth) asks the gateway's /readyz with a 3-second limit and answers only { status: 'ok' } (200) or { status: 'unavailable' } (503), never cached. Its static route wins over the /api proxy route, so the web server answers it itself.",
      'Security headers on every page (next.config.ts): a Content-Security-Policy without nonces, nosniff, referrer and permissions policies, and no framing.',
      "Reads GATEWAY_URL on the server and the public NEXT_PUBLIC_FIREBASE_* values in the browser. Its .env.example also lists NEXT_PUBLIC_RAZORPAY_KEY_ID, but no code reads it: the checkout takes the key ID from billing's order answer.",
      "Builds as a standalone server for its Docker image (next.config.ts: output 'standalone'); in production Caddy sits in front of it, and it reaches the gateway on the internal network.",
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
      'frontend/src/components/billing/billing-view.tsx#BillingView',
      'frontend/src/components/billing/usage-view.tsx#UsageView',
      'frontend/src/lib/uploads.ts#uploadFile',
    ],
  },
  {
    id: 'gateway',
    name: 'Gateway',
    kind: 'app',
    status: 'verified',
    summary:
      "The one public entry to the backend. Each /api request goes through its checks (rate limits, the route allowlist, the origin check and the session lookup) and is then forwarded to its service with a fresh signed internal token. Its route table lists the auth, chat, answer and file routes, billing's account, payment and usage routes, and Razorpay's webhook, the one route open without a session or Origin. The services also listen on their own ports, but each one answers 401 to anything without a valid token except its health checks.",
    responsibilities: [
      "Builds its Express app with createService, with parseJson: false and its /api router as its routes, after the shared middleware and GET /healthz and GET /readyz. Express's trust proxy is set to TRUST_PROXY_HOPS, so req.ip is the client's address.",
      'Limits each IP address to 120 requests a minute (ipRateLimit), for every request that reaches the router, and each signed-in user to 60 (userRateLimit); RATE_LIMIT_PER_IP and RATE_LIMIT_PER_USER can change them. Over the limit is a 429 with Retry-After.',
      "Forwards only what its route table (PUBLIC_ROUTES) lists: POST /api/auth/session, POST /api/auth/dev-session, DELETE /api/auth/session, and GET and PATCH /api/me to auth; GET and POST /api/chats, GET, PATCH and DELETE /api/chats/:id and GET /api/chats/:id/messages to chat; POST /api/chats/:id/messages, the regenerate and edit routes under it, and POST /api/turns/:turnId/stop to the agent, with POST /api/files/uploads, POST /api/files/:fileId/complete, GET /api/files/:fileId and GET /api/files/:fileId/url; GET /api/billing/account, GET /api/billing/plans, POST /api/billing/orders, POST /api/billing/orders/:orderId/verify, GET /api/billing/payments, GET /api/usage/summary and GET /api/usage/events to billing; and POST /api/webhooks/razorpay to billing with no session. A :id must be 1 to 64 letters, digits, - or _. Anything else gets the gateway's own 404 and never reaches a service.",
      'Refuses a request that changes something (any method but GET, HEAD and OPTIONS) unless its Origin is one of FRONTEND_ORIGIN, with 403 (originCheck). A route marked webhook skips this check: it comes from a server, and its service checks the signature instead.',
      'Looks the session cookie up in Redis on every matched request, which renews it (sessionLookup), and answers 401 itself for a route that needs a session when there is none (requireSession).',
      'Forwards the request (proxyToService) with fetch: raw body up to 1 MB, a few allowed headers (plus the signature headers of a webhook route, for that route only), the cookie only to auth, X-Request-Id, and an internal token signed for that service that names the user. It passes back the status, a few headers, every Set-Cookie and the streamed body. A service that is down or does not start answering within 10 seconds gives 503.',
      'Checks its settings at startup (rules in env-schema.ts) and refuses to start if one is missing or invalid: REDIS_URL, FRONTEND_ORIGIN (one origin or a comma-separated list), the four service URLs and INTERNAL_PRIVATE_KEY, which must parse as an Ed25519 private key. PORT, NODE_ENV, LOG_LEVEL, TRUST_PROXY_HOPS (1), RATE_LIMIT_PER_IP (120) and RATE_LIMIT_PER_USER (60) have defaults.',
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
      "Serves the internal routes (internalRouter) for the agent service: read a chat, auto-title it while it is still 'New chat', read its recent finished messages and its last turn (for regenerate and edit), save a message once per clientMessageId, fill in an answer, and say which of a list of chats are gone for a user (for the agent's file clean-up). A user's message keeps its attachments and an answer its citations and the IDs of the files it made (fileRefs), never links. Answers can be long (code files), so chat takes request bodies up to 2 MB and message text up to 400,000 characters. Only tokens signed with the agent's key may use them (requireCaller), and the gateway has no route to them.",
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
      'Writes the answers. A message, a regenerate or an edit reaches it through the gateway; it checks the chat, the credits and any attached files, picks the agent (chat, search, code, questions about a PDF or an image, or making a PDF, a deck or an image), holds the credits in billing, saves the messages in chat and streams the answer from an AI provider as server-sent events, then charges or releases the credits. A stop can reach the answer from any instance. It also takes uploads to S3, checks what arrived, indexes PDFs into Qdrant, saves the files its agents make, and removes the files of deleted chats.',
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience agent; only the gateway is trusted) in front of turnRouter and fileRouter.',
      "Serves the answer routes (turnRouter): POST /chats/:chatId/turns, POST /chats/:chatId/messages/:messageId/regenerate and /edit (latest turn only), all through one runTurn core, and POST /turns/:turnId/stop. Before the stream: 404 for someone else's chat, 409 for a request already being answered, 402 before any AI call when the user has no credits (SEC-03), 404 or 409 for an attached file that is not the user's, not ready or still being read (resolveAttachments, before any charge), and 429 over the routed agent's per-minute limit. Then the streamed answer (meta, agent, sources, artifact, citations, progress, file, token, usage, title, error and done events). A finished answer is committed; a failure, or a stop before the first token, is released; a stop after text started is committed.",
      'Stops an answer on whichever instance runs it (createStopSignals): the owner is checked in Redis, then the turn ID is published on a Redis channel every instance listens to.',
      "Runs up to eight agents (buildAgents): chat and code always; search with web search (Tavily, or canned results in mock mode); and, only with storage, PDF questions (pdf_qa: the five closest passages from the user's own documents, cited as [p. N]), image questions (image_qa, with Gemini or mock mode: the image sent to the vision route as a data URL), and PDF, slides and image, which make a file from a checked outline (pdfkit, pptxgenjs, or Pollinations) and save it under the user's generated files.",
      'Records every model attempt in its llmCalls collection (llmCallRecorder), without waiting for the write.',
      "Serves the file routes (fileRouter): POST /files/uploads checks the type (PDF up to 20 MB; PNG, JPEG or WebP up to 10 MB) and the chat, records the file under a key made from IDs only (SEC-07) and returns a signed S3 form for that key, type and size; POST /files/:fileId/complete checks what arrived (type, size, first bytes, and a PDF's page count, at most 200) and deletes a file that fails; GET /files/:fileId gives the details and indexing status, and GET /files/:fileId/url a fresh 5-minute download link. Without the four S3 settings they answer 503.",
      'Indexes a PDF once its upload completes (indexPdf), in the background: text per page (unpdf), pieces of about 1,000 characters with 200 of overlap, embeddings from Gemini in live mode (a stand-in in mock mode), and points in Qdrant labelled with owner, document, chat and page; the document ends ready or failed. A live check with real Gemini embeddings and a local Qdrant ranked the right page first.',
      "Every ten minutes asks chat which of its files' chats are gone (startFileCleanup), and removes their indexed pieces, objects and records.",
      "Calls chat and billing with its own key (SERVICE_PRIVATE_KEY) through createInternalClient: chat's /internal routes to read the chat, its recent messages and its last turn, save and fill in messages, name a new chat and learn which chats are gone; billing's GET /account and /internal/credits/reserve, commit and release.",
      'Calls the AI providers through its own fetch-based layer (createLlm, createOpenAiCompatibleProvider): Groq, OpenRouter and Gemini over their OpenAI-compatible APIs, with a fallback to the next model only before the first token, a 20-second start limit and a 30-second idle limit. LLM_MODE=mock (the default) answers from a mock provider with no keys.',
      'Picks the agent (routeMessage): a chip or /shortcut, an attachment, or a small router model asked for JSON (completeJson, with one repair); anything unclear, or an agent that is not running, becomes chat. An attached PDF picks pdf_qa and an image image_qa; the router may pick pdf_qa only when the chat has a ready PDF. Titles a new chat while the answer streams (generateTitle).',
      "Keeps each chat's last 20 messages in Redis for an hour (createMemory), a 15-minute lock per request (turn-lock:...), a stop registration per running answer (turn:...) and per-agent rate-limit counters.",
      'Connects to MongoDB at startup and does not start serving until the connection works; the llmCalls records, the files and the indexed documents live there.',
      'Opens a Redis client at startup. /readyz says ready only when both MongoDB and Redis answer.',
      "Checks its settings at startup (rules in env-schema.ts) and refuses to start if a required variable (MONGODB_URI, REDIS_URL, INTERNAL_PUBLIC_KEY, SERVICE_PRIVATE_KEY) is missing, if any value is invalid, or if LLM_MODE is live without GROQ_API_KEY. TAVILY_API_KEY turns on the search agent in live mode. AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY turn on uploads, all four or none (otherwise it logs 'uploads are off: ...'); QDRANT_URL picks Qdrant over an in-memory vector store. Uploads have been tested only against an in-memory bucket: a live run needs a bucket the agent's key can use.",
      'On SIGTERM or SIGINT, finishes in-flight requests, then stops the file clean-up, closes the stop signals, disconnects MongoDB and closes Redis.',
    ],
    path: 'backend/services/agent',
    port: 8003,
    entryPoints: [
      'backend/services/agent/src/index.ts#(module)',
      'backend/services/agent/src/app.ts#createApp',
      'backend/services/agent/src/turns.ts#turnRouter',
      'backend/services/agent/src/turns.ts#runTurn',
      'backend/services/agent/src/agents/index.ts#buildAgents',
      'backend/services/agent/src/llm/llm.ts#createLlm',
      'backend/services/agent/src/files/file-routes.ts#fileRouter',
      'backend/services/agent/src/rag/indexer.ts#indexPdf',
      'backend/services/agent/src/agents/pdf-qa.ts#createPdfQaAgent',
      'backend/services/agent/src/agents/generate.ts#createPdfAgent',
    ],
  },
  {
    id: 'billing',
    name: 'Billing service',
    kind: 'app',
    status: 'verified',
    summary:
      "Owns credits: one account per user with its plan and balance, a hold for each answer in progress, an append-only ledger, and the payments that buy more. The gateway forwards the account, plans, orders, payment check, payment history and usage routes to it, and Razorpay's webhook; auth calls it for the sign-up grant and the agent to hold, charge and release credits, each with its own key. It sells credits through Razorpay, in test mode.",
    responsibilities: [
      'Builds its Express app with createService: the shared middleware, GET /healthz and GET /readyz, then the internal-token check (audience billing; it trusts the gateway, auth and the agent) in front of accountRouter, paymentRouter, usageRouter and internalRouter.',
      "Serves GET /account (the plan and balance, for the credits card and the agent's balance check) and the internal routes: POST /internal/accounts for auth only, and POST /internal/credits/reserve, commit and release for the agent only (requireCaller). Other signers get 403.",
      'Grants 100 sign-up credits once per user (grantSignupCredits), even when sign-ins race.',
      "Sells credits (paymentRouter): GET /plans (Starter and Pro from PLANS), POST /orders (priced on the server from the plan; the strict body names only the plan), POST /orders/:orderId/verify (Razorpay's HMAC of order|payment with the key secret, and the order's owner), GET /payments (the last 50) and POST /webhooks/razorpay (an HMAC of the raw body with the webhook secret, each event ID handled once). Verify and the webhook share one grant (grantPurchase) that marks the payment paid, appends the purchase entry, raises the balance and sets a 30-day plan badge in one transaction, once per payment (SEC-05).",
      "Reports usage (usageRouter): GET /usage/summary sums the usage ledger entries by agent and by day in the viewer's time zone (tz), and GET /usage/events lists the latest answers with their model, tokens and time taken.",
      "Holds an answer's credits with one conditional update on balance >= cost, so parallel answers can never overdraw (reserveCredits, SEC-08); the amount comes from CREDIT_COSTS. Commit appends a usage ledger entry; release gives the credits back. Each happens once, in a transaction.",
      'Keeps accounts, reservations, the ledger, payments and handled webhook events in MongoDB (AccountModel, ReservationModel, LedgerModel, PaymentModel, WebhookEventModel). The balance always equals the sum of the ledger minus the credits on hold, which the tests check.',
      'Releases holds still held after 10 minutes, every minute (startReservationSweeper), say after an agent crash.',
      'Connects to MongoDB at startup and does not start serving until the connection works. /readyz pings it.',
      'Imports INTERNAL_PUBLIC_KEY, AUTH_PUBLIC_KEY and AGENT_PUBLIC_KEY with importInternalPublicKey at startup. A key it cannot read stops startup with exit code 1.',
      "Checks its settings at startup and refuses to start if a required variable (MONGODB_URI and the three public keys) is missing, or if any value is invalid. PORT, NODE_ENV and LOG_LEVEL have defaults. RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET turn payments on, all three or none; without them it logs 'payments are off: ...' and the payment routes answer 503.",
      'On SIGTERM or SIGINT, finishes in-flight requests, then stops the sweeper and disconnects MongoDB.',
    ],
    path: 'backend/services/billing',
    port: 8004,
    entryPoints: [
      'backend/services/billing/src/index.ts#(module)',
      'backend/services/billing/src/app.ts#createApp',
      'backend/services/billing/src/credits.ts#reserveCredits',
      'backend/services/billing/src/internal-routes.ts#internalRouter',
      'backend/services/billing/src/payment-routes.ts#paymentRouter',
      'backend/services/billing/src/credits.ts#grantPurchase',
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
      "createService builds an Express app with the middleware in a fixed order: request ID, request logging (health probes skipped), security headers (helmet), JSON body (64kb by default, only when parseJson is true, the default; the exact bytes are kept for rawBodyOf, for webhook signatures), /healthz and /readyz, the internal-token check (only with the internalAuth option: every route except /healthz and /readyz then needs a valid internal token, so a direct call gets 401 on any path, unless the body parser rejects its JSON body first), the app's routes, then 404 and error handling.",
      "startService opens the port and shuts down cleanly on SIGTERM or SIGINT: stop taking new connections, wait up to 10 seconds for in-flight requests, then run the app's cleanup. Later signals are ignored, so one Ctrl+C under pnpm dev, which reaches the app twice, still shuts it down cleanly.",
      "loadEnv checks each app's settings at startup and lists every problem at once, without printing the values.",
      'createLogger makes a pino logger that hides secrets such as tokens, cookies and passwords.',
      'connectMongo, pingMongo, createRedis and pingRedis open the database connections and provide the checks behind /readyz.',
      "Its setup:keys script (pnpm setup:keys) writes three key pairs into the .env files, without printing them: the gateway's private key and every service's matching public key, and auth's and the agent's own private keys with their public keys for the services they call (billing for auth; chat and billing for the agent).",
      "Internal tokens: each token names its signer (INTERNAL_CALLERS: gateway, auth, agent). The gateway signs one for each forwarded request (signInternalToken); auth and the agent sign their own calls through createInternalClient, which also keeps the request ID, times out after 5 seconds, can retry once and passes the other service's error codes on. Services check every token against the keys they trust (createService's internalAuth option with callers, requireInternalToken, verifyInternalToken). Routes that act for a user add requireUser, and internal routes meant for one service add requireCaller.",
      'Sessions: auth creates and deletes them (createSession, deleteSession); the gateway looks them up on each request (sessionIdFromCookies, resolveSession).',
      "Rate limits: the gateway's per-IP and per-user limits (rateLimit, hitRateLimit, GATEWAY_RATE_LIMITS). The validate request middleware checks the params, query and bodies of the services' routes.",
      'Shared constants: chat and billing use the agent list (AGENTS), billing the credit costs, the sign-up credits and the plan names, and the agent the price of a chat answer. The per-agent rate limits are built and tested, but not used by any app yet.',
      'It re-exports mongoose, so every model uses the connection connectMongo opens: auth its users, chat its conversations and messages, billing its accounts, holds, ledger, payments and webhook events, and the agent its model call records, files and documents.',
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
      "The agent keeps a record of every model attempt in gilder_agent's llmCalls collection (indexed by user and time), and its files and indexed PDF documents there too, each looked up by its owner.",
      'Billing keeps accounts (keyed by the user ID), reservations, the ledger, payments and webhook events in gilder_billing. Partial unique indexes allow one sign-up grant per user, one usage entry per reservation and one purchase entry per payment; a unique idempotency key makes each reserve happen once; a payment has a unique order ID and a unique payment ID once paid; and a webhook event is stored under its event ID.',
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
      "The agent caches each chat's last 20 messages as the list mem:<chat ID> for an hour, locks a request being answered with turn-lock:<chat ID>:<client message ID> for up to 15 minutes, registers a running answer's owner as turn:<turn ID>, counts per-agent limits as rl:agent-<agent>:<user ID>, and carries stops between its instances on the turn-stops channel (publish and subscribe).",
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
    status: 'verified',
    summary:
      "A vector database, run locally in Docker. The agent stores the pieces of uploaded PDFs in it, with their embeddings, over Qdrant's REST API with fetch (no SDK). PDF questions search it, always within the user's own documents. A live check with real Gemini embeddings ranked the right page first.",
    responsibilities: [
      'Runs qdrant v1.16.0 on host port 6335, not the usual 6333. Data lives in the qdrant-data volume.',
      'The agent uses it when QDRANT_URL is set (its .env.example sets http://localhost:6335), and an in-memory store otherwise (createQdrantStore, createMemoryVectorStore).',
      'One collection, document_chunks: 768-number vectors with cosine distance, created on first use with keyword indexes on userId, documentId and chatId. Each point holds its owner, document, chat, page and text.',
      "Every search and every delete filters by the owner and the document IDs, so one user's documents never answer another's question. The file clean-up deletes the pieces of deleted chats.",
      "The agent's /readyz does not check it: a Qdrant outage only fails indexing, which marks the document failed.",
    ],
    port: 6335,
    entryPoints: ['backend/services/agent/src/rag/vector-store.ts#createQdrantStore'],
  },
  {
    id: 's3',
    name: 'AWS S3',
    kind: 'datastore',
    status: 'verified',
    summary:
      "File storage, even in development, which is why there is no storage container in Docker. The agent signs short-lived forms for uploads and links for downloads; clients upload straight to the bucket, and nothing in it is public. The code is tested only against an in-memory bucket: a live run needs a bucket the agent's key can use.",
    responsibilities: [
      'The agent uses it when AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are all set (createS3FileStore, with the AWS SDK); otherwise uploads answer 503.',
      'Uploads use a presigned POST that fixes the key, the Content-Type and a size range, valid for 5 minutes. Downloads use a signed GET link, also valid for 5 minutes, that saves the file under its display name.',
      'Keys are users/<user ID>/uploads/<file ID> for uploads and users/<user ID>/generated/<file ID> for the files agents make, built from IDs only (SEC-07). The agent reads the first bytes and a PDF whole to check them, reads an attached image for an image question, and deletes files that fail, and the files of deleted chats.',
    ],
    entryPoints: ['backend/services/agent/src/files/file-store.ts#createS3FileStore'],
  },

  // -------------------------------------------------------------------------------------------
  // Outside services (Firebase from auth, the AI providers, Tavily and Pollinations from the agent, and Razorpay from billing)

  {
    id: 'llm-providers',
    name: 'LLM providers (Groq, OpenRouter, Gemini)',
    kind: 'external',
    status: 'verified',
    summary:
      "The language models the agent calls to write answers and outlines and to look at images, all over their OpenAI-compatible chat-completions APIs with fetch, and Gemini's embedding model for PDF indexing and questions. Each is used only when its key is set and LLM_MODE is live; the default, mock, calls none of them.",
    responsibilities: [
      'Groq: chat, search and PDF question answers and the outlines of files (openai/gpt-oss-120b, then openai/gpt-oss-20b), routing, titles and search queries (openai/gpt-oss-20b), and code when OpenRouter has no key (openai/gpt-oss-120b). Live mode needs its key. A live check: Groq wrote a document outline and the PDF was drawn in about 1.5 seconds.',
      'OpenRouter: code answers (deepseek/deepseek-chat), when OPENROUTER_API_KEY is set.',
      "Gemini: image questions through the vision route, gemini-3.5-flash, then gemini-3.8-flash, then gemini-flash-latest, each with low reasoning (Google retired gemini-2.5-flash for new keys). The image goes as a data URL in an image_url part. A live check: Gemini answered 'Red' for a generated red PNG.",
      'Gemini embeds the pieces of uploaded PDFs (gemini-embedding-001, 768 numbers each, 100 per call to its batchEmbedContents API), when GEMINI_API_KEY is set and LLM_MODE is live (createGeminiEmbedder). A live check with a local Qdrant ranked the right page first.',
    ],
  },
  {
    id: 'tavily',
    name: 'Tavily',
    kind: 'external',
    status: 'verified',
    summary:
      'The web search API behind the search agent: up to 5 results with images per answer, called with fetch when TAVILY_API_KEY is set and LLM_MODE is live. Mock mode uses canned results instead.',
    responsibilities: [],
  },
  {
    id: 'pollinations',
    name: 'Pollinations',
    kind: 'external',
    status: 'verified',
    summary:
      'The image generation API behind the image agent: one GET with the prompt in the path for a 1024×1024 image, no key needed, called with fetch in live mode. Mock mode draws a one-colour PNG instead. A live check returned a 1024×1024 JPEG in about 10 seconds.',
    responsibilities: [
      'The agent asks for the image without a logo and as private, waits up to 90 seconds, and accepts only a JPEG or PNG of at most 8 MB; anything else is a 503 and the answer fails without a charge.',
    ],
    entryPoints: ['backend/services/agent/src/generate/images.ts#pollinationsImage'],
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    kind: 'external',
    status: 'verified',
    summary:
      "The payment provider billing sells plans through, in test mode. Billing creates each order over Razorpay's REST API with fetch (no SDK); the browser pays in Razorpay's checkout window; billing checks every result's HMAC signature before granting anything. Razorpay also reports captured payments to the webhook.",
    responsibilities: [
      'Orders: POST https://api.razorpay.com/v1/orders with the key ID and secret, the price from PLANS in paise and a 10-second limit (createRazorpay).',
      "Checkout: checkout.js, loaded in the browser only when someone buys (openCheckout). It returns a payment ID and a signature, an HMAC-SHA256 of '<order ID>|<payment ID>' with the key secret.",
      'Webhook: POST /api/webhooks/razorpay with x-razorpay-signature (an HMAC-SHA256 of the body with the webhook secret) and x-razorpay-event-id. Billing acts on payment.captured.',
      "Tests check the signatures for real and make orders locally; they never call Razorpay's API.",
    ],
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
    label:
      'Connects at startup; /readyz pings it. Saves a record of every model attempt in llmCalls (gilder_agent), without waiting for the write, and keeps the files and indexed documents there',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/index.ts#(module)',
      'backend/services/agent/src/index.ts#app',
      'backend/shared/src/mongo.ts#connectMongo',
      'backend/shared/src/mongo.ts#pingMongo',
      'backend/services/agent/src/telemetry.ts#LlmCallModel',
      'backend/services/agent/src/telemetry.ts#llmCallRecorder',
      'backend/services/agent/src/files/models.ts#FileModel',
      'backend/services/agent/src/files/models.ts#DocumentModel',
    ],
  },
  {
    from: 'billing',
    to: 'mongodb',
    kind: 'data',
    label:
      'Connects at startup; /readyz pings it. Keeps accounts, credit holds, the ledger, payments and webhook events in gilder_billing, changing each balance in a transaction with its ledger entry, hold or payment',
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
      'backend/services/billing/src/models.ts#PaymentModel',
      'backend/services/billing/src/models.ts#WebhookEventModel',
      'backend/services/billing/src/credits.ts#grantPurchase',
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
      "Opens a client at startup; /readyz sends PING. Caches each chat's last 20 messages (mem:...), locks a request while it is answered (turn-lock:...), counts per-agent limits (rl:agent-...), and registers running answers (turn:...) and carries stops between instances on the turn-stops channel, over a second connection",
    status: 'verified',
    evidence: [
      'backend/services/agent/src/index.ts#redis',
      'backend/services/agent/src/index.ts#app',
      'backend/shared/src/redis.ts#createRedis',
      'backend/shared/src/redis.ts#pingRedis',
      'backend/services/agent/src/memory.ts#createMemory',
      'backend/services/agent/src/turns.ts#runTurn',
      'backend/services/agent/src/stops.ts#createStopSignals',
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

  // Gateway → billing: the balance, buying credits, usage, and Razorpay's webhook.
  {
    from: 'gateway',
    to: 'billing',
    kind: 'http',
    label:
      "The account, plans, orders, payment check, payment history and usage routes, each with a fresh internal token for billing that names the user; and Razorpay's webhook, with no session or Origin check and its two signature headers passed on",
    status: 'verified',
    evidence: [
      'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
      'backend/gateway/src/proxy.ts#proxyToService',
      'backend/gateway/src/guards.ts#originCheck',
      'backend/services/billing/src/account-routes.ts#accountRouter',
      'backend/services/billing/src/payment-routes.ts#paymentRouter',
      'backend/services/billing/src/usage-routes.ts#usageRouter',
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
      "During a turn: reads the chat, its recent messages and its last turn, saves the user's message and the answer (superseding replaced ones), fills the answer in with its sources, citations, code files and generated file IDs, and names a new chat; every ten minutes, asks which chats are gone (POST /internal/chats/deleted). All through chat's /internal routes with the agent's own key",
    status: 'verified',
    evidence: [
      'backend/services/agent/src/services.ts#chatService',
      'backend/shared/src/internalClient.ts#createInternalClient',
      'backend/services/agent/src/turns.ts#turnRouter',
      'backend/services/agent/src/rag/cleanup.ts#cleanUpDeletedChats',
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
      'Streams answers, routing, titles, search queries and file outlines from Groq, code from OpenRouter and image answers from Gemini when their keys are set, over their OpenAI-compatible APIs; embeds PDF pieces and questions with Gemini. In live mode only',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/llm/openai-compatible.ts#createOpenAiCompatibleProvider',
      'backend/services/agent/src/llm/providers.ts#buildProviders',
      'backend/services/agent/src/llm/llm.ts#createLlm',
      'backend/services/agent/src/llm/models.ts#MODEL_ROUTES',
      'backend/services/agent/src/rag/embeddings.ts#createGeminiEmbedder',
      'backend/services/agent/src/agents/image-qa.ts#createImageQaAgent',
    ],
  },

  // Gateway → agent: the answer routes, streamed back.
  {
    from: 'gateway',
    to: 'agent',
    kind: 'http',
    label:
      'Send, regenerate and edit (each streams the answer back), stop, and the file routes (start and complete an upload, details, download link), from the route table, each with a fresh internal token for the agent that names the user',
    status: 'verified',
    evidence: [
      'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
      'backend/gateway/src/proxy.ts#proxyToService',
      'backend/services/agent/src/turns.ts#turnRouter',
      'backend/services/agent/src/files/file-routes.ts#fileRouter',
    ],
  },
  {
    from: 'agent',
    to: 'tavily',
    kind: 'external',
    label: 'One web search per search answer (up to 5 results), in live mode with TAVILY_API_KEY',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/search/web-search.ts#createTavilySearch',
      'backend/services/agent/src/agents/search.ts#createSearchAgent',
    ],
  },

  // Files and PDF indexing: S3 and Qdrant, each used only when its settings are set.
  {
    from: 'agent',
    to: 's3',
    kind: 'data',
    label:
      "Signs upload forms and download links, reads uploads to check them and images to answer about them, saves the files its agents make, and deletes refused files and those of deleted chats, with the AWS SDK. Tested only against an in-memory bucket; a live run needs a bucket the agent's key can use",
    status: 'verified',
    evidence: [
      'backend/services/agent/src/files/file-store.ts#createS3FileStore',
      'backend/services/agent/src/files/file-routes.ts#fileRouter',
      'backend/services/agent/src/rag/cleanup.ts#cleanUpDeletedChats',
      'backend/services/agent/src/files/generated.ts#saveGenerated',
    ],
  },
  {
    from: 'agent',
    to: 'qdrant',
    kind: 'data',
    label:
      "Stores the pieces of uploaded PDFs with their embeddings, searches them for PDF questions within the owner's documents, and deletes those of deleted chats, over the REST API with fetch, when QDRANT_URL is set",
    status: 'verified',
    evidence: [
      'backend/services/agent/src/rag/vector-store.ts#createQdrantStore',
      'backend/services/agent/src/rag/indexer.ts#indexPdf',
      'backend/services/agent/src/agents/pdf-qa.ts#createPdfQaAgent',
      'backend/services/agent/src/rag/cleanup.ts#cleanUpDeletedChats',
    ],
  },
  {
    from: 'agent',
    to: 'pollinations',
    kind: 'external',
    label: 'One request per image the image agent draws, in live mode (no key needed)',
    status: 'verified',
    evidence: [
      'backend/services/agent/src/generate/images.ts#pollinationsImage',
      'backend/services/agent/src/agents/generate.ts#createImageAgent',
    ],
  },
  {
    from: 'browser',
    to: 's3',
    kind: 'http',
    label:
      "Posts attached files straight to the bucket with the agent's signed form, and loads generated images and downloads from short-lived signed links. Tested only against an in-memory bucket; a live run needs a bucket the agent's key can use",
    status: 'verified',
    evidence: [
      'frontend/src/lib/uploads.ts#uploadFile',
      'frontend/src/lib/uploads.ts#openFile',
      'frontend/src/components/chat/generated-files.tsx#GeneratedFiles',
    ],
  },

  // Payments: billing makes orders, the browser pays in Razorpay's window, Razorpay reports back.
  {
    from: 'billing',
    to: 'razorpay',
    kind: 'external',
    label:
      'Creates an order for each purchase (test mode), priced from the plan config, over the REST API with fetch',
    status: 'verified',
    evidence: [
      'backend/services/billing/src/razorpay.ts#createRazorpay',
      'backend/services/billing/src/payment-routes.ts#paymentRouter',
    ],
  },
  {
    from: 'browser',
    to: 'razorpay',
    kind: 'external',
    label:
      "Razorpay's checkout window (checkout.js, loaded on demand): the user pays there, and it hands back the payment ID and signature",
    status: 'verified',
    evidence: [
      'frontend/src/lib/razorpay-checkout.ts#openCheckout',
      'frontend/src/components/billing/billing-view.tsx#BillingView',
    ],
  },
  {
    from: 'razorpay',
    to: 'frontend',
    kind: 'http',
    label:
      'The payment webhook, POST /api/webhooks/razorpay, signed over its body; the Next.js server and the gateway pass it to billing unchanged',
    status: 'verified',
    evidence: [
      'frontend/src/server/gateway-proxy.ts#forwardToGateway',
      'backend/gateway/src/route-table.ts#PUBLIC_ROUTES',
      'backend/services/billing/src/payment-routes.ts#paymentRouter',
    ],
  },
];

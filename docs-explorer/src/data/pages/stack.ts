import type { DocPage, PackageNote, PlannedTool } from '../schema.ts';

export const stackPage: DocPage = {
  id: 'stack',
  title: 'Tech stack',
  summary:
    'What GilderAi is built with today, how the pieces connect, and the tools the roadmap adds next.',
  sections: [
    {
      id: 'how-it-fits',
      title: 'How the pieces fit',
      status: 'partial',
      blocks: [
        {
          kind: 'text',
          text: "A request goes from the browser to the Next.js server, then to the gateway, then to one service, which reads and writes its data stores. Today that path carries sign-in, logout, the profile, chats (the list and search, renaming, pinning and deleting, and each chat's history), answers streamed back from the agent, the credits balance, buying credits, the usage page and file uploads, end to end.",
        },
        {
          kind: 'list',
          items: [
            'Browser → Next.js server (port 3000): the browser only ever talks to the frontend app. Its chat data lives in a Redux store, fetched and cached with RTK Query.',
            "Next.js server → gateway (port 8000): the Next.js server forwards every `/api/*` call to the gateway (`forwardToGateway`), so backend addresses and secrets never reach the browser. Server components also call the gateway directly with the browser's cookie (`gatewayGet`), for the signed-in user and for a chat page.",
            'Gateway → services: the gateway checks the rate limits, its route table, the Origin and the session, then calls the service with fetch and a short-lived signed token: auth (8001), chat (8002), the agent (8003) and billing (8004), for the routes in its table. An answer streams back through the gateway and the Next.js server as it is written.',
            'Service → service: auth calls billing for the sign-up grant, and the agent calls chat and billing during a turn, each with fetch and a token signed with its own key (`createInternalClient`).',
            "Agent → outside services: the agent streams answers from Groq (and code from OpenRouter when its key is set) over their OpenAI-compatible APIs, and searches the web with Tavily, all with fetch and no SDK. It embeds the pieces of uploaded PDFs with Gemini's embedding API, also with fetch. By default (`LLM_MODE=mock`) a mock provider, canned search results and a stand-in embedder answer instead, so nothing needs a key.",
            "Services → data stores: auth, chat, agent and billing connect to MongoDB at startup, and the gateway, auth and agent open a Redis client. Auth keeps its users in MongoDB and its sessions in Redis; chat keeps conversations and messages, and billing accounts, credit holds and the ledger, in MongoDB; the agent keeps a record of every model attempt in MongoDB, and a short memory of each chat, request locks, per-agent limits and stop signals in Redis. Billing also keeps payments and webhook events, and the agent its files and indexed documents, in MongoDB. The agent stores PDF pieces in Qdrant (over its REST API) when QDRANT_URL is set, and files in AWS S3 when its four S3 settings are set; S3 has been tested only against an in-memory bucket, and a live run needs a bucket the agent's key can use.",
            "Billing → Razorpay: billing creates each order over Razorpay's REST API with fetch, no SDK, and checks every payment's HMAC signature. The browser pays in Razorpay's checkout window, and Razorpay's webhook comes back through the Next.js server and the gateway to billing.",
            'Every backend app is built from the shared library, `@gilder/shared`, so they all start, log and fail in the same way.',
          ],
        },
      ],
      refs: [
        { component: 'browser' },
        { component: 'frontend' },
        { component: 'gateway' },
        { component: 'auth' },
        { component: 'chat' },
        { component: 'agent' },
        { component: 'billing' },
        { component: 'shared' },
        { component: 'mongodb' },
        { component: 'redis' },
        { component: 'llm-providers' },
        { component: 'tavily' },
        { component: 'qdrant' },
        { component: 's3' },
        { component: 'razorpay' },
        { flow: 'buy-credits' },
        { flow: 'upload-file' },
      ],
    },
    {
      id: 'runtime',
      title: 'Runtime: Node 22 runs the TypeScript',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'Every app runs on Node.js 22. `.nvmrc` sets the version for `nvm use` and for CI, and the root `package.json` requires `>=22.18 <23`. From 22.18 on, Node strips TypeScript types by itself, so the backend apps run their `.ts` files directly: there is no compile step and no build output.',
        },
        { kind: 'quote', file: '.nvmrc', text: '22', caption: 'The Node version, for nvm and CI' },
        {
          kind: 'text',
          text: 'The TypeScript compiler only checks types (`tsc --noEmit`, run by `pnpm typecheck`). Since Node only removes types, the backend may use only TypeScript that can simply be erased, which `erasableSyntaxOnly` in `tsconfig.base.json` enforces. The frontend is different: Next.js compiles it.',
        },
      ],
      refs: [
        { file: '.nvmrc' },
        { file: 'package.json' },
        { file: 'tsconfig.base.json' },
        { flow: 'app-startup' },
      ],
    },
    {
      id: 'workspace',
      title: 'One pnpm workspace',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'All apps live in one repository and one pnpm workspace (pnpm 11, set by `packageManager` in the root `package.json`). One `pnpm install` installs every app, and root scripts such as `pnpm dev` and `pnpm test` run the same script in each app that has it (`pnpm dev` leaves out the docs explorer). The backend apps depend on the shared library as `"@gilder/shared": "workspace:*"`, so they always use the copy in this repo.',
        },
        {
          kind: 'quote',
          file: 'pnpm-workspace.yaml',
          text: '  - frontend\n  - backend/gateway\n  - backend/services/*\n  - backend/shared\n  - docs-explorer',
          caption: 'The apps in the workspace',
        },
      ],
      refs: [{ file: 'pnpm-workspace.yaml' }, { file: 'package.json' }, { component: 'shared' }],
    },
    {
      id: 'ai-providers',
      title: 'AI providers, called with fetch',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'The agent calls language models through its own small layer instead of an SDK or an agent framework. Groq, OpenRouter and Gemini all offer the OpenAI chat-completions API, so one fetch-based client (`createOpenAiCompatibleProvider`) streams from any of them, reads the server-sent events and reports token usage. `MODEL_ROUTES` says which models serve each kind of call; `createLlm` picks the first whose provider has a key, and moves to the next only if one fails before its first token.',
        },
        {
          kind: 'table',
          columns: ['Kind of call', 'Models, first choice first', 'Used today by'],
          rows: [
            [
              'router, title',
              'Groq openai/gpt-oss-20b',
              'Routing, new-chat titles and search queries',
            ],
            ['chat', 'Groq openai/gpt-oss-120b, then openai/gpt-oss-20b', 'The chat agent'],
            ['write', 'Groq openai/gpt-oss-120b, then openai/gpt-oss-20b', 'The search agent'],
            [
              'code',
              'OpenRouter deepseek/deepseek-chat, then Groq openai/gpt-oss-120b',
              'The code agent',
            ],
            ['vision', 'Gemini gemini-2.5-flash', 'No agent yet'],
          ],
        },
        {
          kind: 'text',
          text: '`LLM_MODE=live` calls the real providers and needs `GROQ_API_KEY`; `mock`, the default, streams canned text word by word from a mock provider, so development, tests and CI need no keys.',
        },
        {
          kind: 'text',
          text: "PDF pieces are embedded apart from these routes, with Gemini's `gemini-embedding-001` over its own `batchEmbedContents` API (`createGeminiEmbedder`), in live mode with `GEMINI_API_KEY`. Mock mode uses a stand-in that hashes words into a vector (`mockEmbedder`). A live check with a local Qdrant ranked the right page first.",
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/llm/providers.ts',
          text: "baseUrl: 'https://api.groq.com/openai/v1',",
          caption: 'Groq, through its OpenAI-compatible API',
        },
      ],
      refs: [
        { component: 'llm-providers' },
        { component: 'agent' },
        { symbol: 'backend/services/agent/src/llm/llm.ts#createLlm' },
        { symbol: 'backend/services/agent/src/llm/models.ts#MODEL_ROUTES' },
        {
          symbol:
            'backend/services/agent/src/llm/openai-compatible.ts#createOpenAiCompatibleProvider',
        },
        { symbol: 'backend/services/agent/src/llm/mock.ts#createMockProvider' },
        { symbol: 'backend/services/agent/src/rag/embeddings.ts#createGeminiEmbedder' },
        { flow: 'run-turn' },
        { flow: 'index-pdf' },
      ],
    },
    {
      id: 'packages',
      title: 'Packages',
      status: 'verified',
      blocks: [{ kind: 'packages' }],
    },
  ],
};

export const packageNotes: PackageNote[] = [
  // Frontend
  {
    name: 'next',
    layer: 'frontend',
    why: 'The frontend framework (App Router) on port 3000: the sign-in page, the app shell, the chat page (rendered on the server), the /api proxy route and the login gate (`proxy.ts`).',
  },
  { name: 'react', layer: 'frontend', why: 'The UI library the frontend is written in.' },
  {
    name: 'react-dom',
    layer: 'frontend',
    why: 'Renders the React components to HTML on the server and to the page in the browser.',
  },
  {
    name: 'tailwindcss',
    layer: 'frontend',
    why: 'Tailwind CSS 4: utility classes for styling. `globals.css` imports it and maps the design tokens to class names such as `bg-surface`.',
  },
  {
    name: 'radix-ui',
    layer: 'frontend',
    why: 'Accessible building blocks under the menu, dialog, tooltip, toast and avatar components: keyboard support and focus management.',
  },
  {
    name: 'lucide-react',
    layer: 'frontend',
    why: 'The icons in buttons and menus.',
  },
  {
    name: 'firebase',
    layer: 'frontend',
    why: 'Google sign-in in the browser: a popup that returns the Firebase ID token the app exchanges for a session. Loaded only when the Google button is clicked.',
  },
  {
    name: 'react-markdown',
    layer: 'frontend',
    why: 'Renders answers as Markdown (`Markdown`). Raw HTML in an answer is shown as text and unsafe links are removed; the app also turns images into links and adds highlighted code blocks.',
  },
  {
    name: 'remark-gfm',
    layer: 'frontend',
    why: 'Adds GitHub-style Markdown to react-markdown: tables, task lists, strikethrough and bare links.',
  },
  {
    name: 'highlight.js',
    layer: 'frontend',
    why: 'Colours code in answers and in the files panel (`highlightCode`). Only its core and thirteen common languages are loaded, to keep the bundle small.',
  },
  {
    name: 'fflate',
    layer: 'frontend',
    why: 'Zips the files of a code answer in the browser for Download all (`zipFiles`).',
  },
  {
    name: '@reduxjs/toolkit',
    layer: 'frontend',
    why: "Redux Toolkit and RTK Query: the browser's store (`makeStore`) and the chat data layer (`api`), with cached, paged chat lists, search, and rename, pin and delete that change the list at once and undo it on failure.",
  },
  {
    name: 'react-redux',
    layer: 'frontend',
    why: 'Connects React to the store: `StoreProvider` gives every page one store, and the RTK Query hooks read from it.',
  },
  {
    name: '@tailwindcss/turbopack',
    layer: 'frontend',
    why: 'Builds Tailwind CSS inside Turbopack: `next.config.ts` sends every `.css` file through it.',
  },

  // Backend
  {
    name: 'express',
    layer: 'backend',
    why: "The HTTP framework (Express 5) of every backend app. `createService` builds each app's Express app with the shared middleware.",
  },
  {
    name: 'helmet',
    layer: 'backend',
    why: 'Sets security headers on every backend response. `createService` adds it to every app.',
  },
  {
    name: 'zod',
    layer: 'backend',
    why: "Checks data against schemas: each app's settings at startup (`loadEnv`), request input with `validate`, which the services' routes use, and the JSON the router model returns (`completeJson`).",
  },
  {
    name: 'jose',
    layer: 'backend',
    why: 'Signs and checks the short-lived internal tokens, and makes the key pairs that `pnpm setup:keys` writes. The gateway signs a token with it for every request it forwards, auth and the agent for their calls to other services, and auth, chat, agent and billing check them.',
  },
  {
    name: 'firebase-admin',
    layer: 'backend',
    why: "Checks Google sign-in tokens in the auth service (`createFirebaseVerifier`), including whether a token was revoked. Auth's `POST /sessions` uses it when the three FIREBASE_* settings are set.",
  },
  {
    name: 'cookie',
    layer: 'backend',
    why: "Installed in the shared library. `sessionIdFromCookies` uses it to read the session cookie from a request, for the gateway's session lookup on every forwarded request and for auth's logout route.",
  },
  {
    name: 'pino',
    layer: 'backend',
    why: 'The JSON logger behind `createLogger`, used by every backend app.',
  },
  {
    name: 'pino-http',
    layer: 'backend',
    why: 'Writes one log line for each finished request. It skips only health probes: a GET or HEAD on `/healthz` or `/readyz`.',
  },
  {
    name: 'unpdf',
    layer: 'backend',
    why: 'Reads uploaded PDFs in the agent: their page count when an upload completes (`countPdfPages`), and their text page by page for indexing (`extractPages`).',
  },
  {
    name: 'pino-pretty',
    layer: 'backend',
    why: 'Turns log lines into colored, readable text when an app runs in development.',
  },

  // Data
  {
    name: 'mongoose',
    layer: 'data',
    why: 'Connects the services to MongoDB (`connectMongo`) and checks the connection for `/readyz` (`pingMongo`). Auth defines its users model with it, chat its conversations and messages models, billing its accounts, reservations, ledger, payments and webhook events, whose changes run in its transactions, and the agent its call records, files and documents. The shared library re-exports it, so every app uses one copy and the connection `connectMongo` opens.',
  },
  {
    name: 'ioredis',
    layer: 'data',
    why: "The Redis client. `createRedis` makes one for the gateway, auth and agent, and `pingRedis` checks it for `/readyz`. The shared sessions and rate limits use it too: auth creates and deletes sessions, and the gateway looks them up and counts requests. The agent keeps each chat's recent messages and a lock per message being answered in it. Their tests run against a real Redis.",
  },

  {
    name: '@aws-sdk/client-s3',
    layer: 'data',
    why: "The AWS S3 client behind the agent's file store (`createS3FileStore`): it checks, reads, writes and deletes objects. Used only when the agent's four S3 settings are set; the tests use an in-memory bucket instead.",
  },
  {
    name: '@aws-sdk/s3-presigned-post',
    layer: 'data',
    why: 'Signs the upload form (`uploadForm`): a presigned POST that fixes the key, the Content-Type and a size range, so S3 itself refuses anything else.',
  },
  {
    name: '@aws-sdk/s3-request-presigner',
    layer: 'data',
    why: 'Signs the 5-minute download links (`downloadUrl`).',
  },

  // Quality
  {
    name: 'typescript',
    layer: 'quality',
    why: 'Checks types with `tsc --noEmit` in every app. It never compiles the backend: Node runs the `.ts` files directly.',
  },
  {
    name: 'vitest',
    layer: 'quality',
    why: 'Runs the tests of the shared library, every backend app and the frontend (`pnpm test`).',
  },
  {
    name: '@testing-library/react',
    layer: 'quality',
    why: 'Renders frontend components in tests and finds elements the way a user would, by role and label.',
  },
  {
    name: '@testing-library/user-event',
    layer: 'quality',
    why: 'Clicks and types in component tests like a real user, focus and keyboard included.',
  },
  {
    name: 'jsdom',
    layer: 'quality',
    why: 'A browser-like DOM for the frontend component tests, which opt into it per file.',
  },
  {
    name: 'supertest',
    layer: 'quality',
    why: 'Sends HTTP requests to an Express app in tests. It serves the app on a temporary local port, so no fixed port or running server is needed.',
  },
  {
    name: 'mongodb-memory-server',
    layer: 'quality',
    why: "Starts a real MongoDB in memory, so tests need no Docker: a replica set for the shared library's MongoDB tests, and a single server for each test file that uses `startTestMongo` (auth's and chat's tests, and the gateway's journey test). Redis tests use the Redis container, or the CI service.",
  },
  {
    name: 'eslint',
    layer: 'quality',
    why: 'Finds mistakes in the code. The root config covers the backend and root files; the frontend has its own config.',
  },
  {
    name: '@eslint/js',
    layer: 'quality',
    why: "ESLint's recommended JavaScript rules, the base of the root lint config.",
  },
  {
    name: 'typescript-eslint',
    layer: 'quality',
    why: 'TypeScript rules for the root lint config, such as no `any` and type-only imports.',
  },
  {
    name: 'globals',
    layer: 'quality',
    why: 'Tells the root lint config which global variables Node.js provides, such as `process`.',
  },
  {
    name: 'eslint-config-next',
    layer: 'quality',
    why: "Next.js's lint rules (Core Web Vitals and TypeScript) for the frontend.",
  },
  {
    name: 'eslint-config-prettier',
    layer: 'quality',
    why: "Turns off lint rules that would fight Prettier's formatting. It comes last in the root lint config.",
  },
  {
    name: 'prettier',
    layer: 'quality',
    why: 'Formats the code. CI fails when a file is not formatted (`pnpm format:check`).',
  },
];

export const plannedTools: PlannedTool[] = [
  // AI
  {
    name: 'Gemini',
    layer: 'ai',
    why: "Google's gemini-2.5-flash, for questions about images. Its chat client is built (used when GEMINI_API_KEY is set), but no running agent sends it anything yet. Gemini's embedding model already indexes PDFs.",
    plannedIn: 'PDF and image Q&A',
  },
  {
    name: 'Pollinations',
    layer: 'ai',
    why: 'An image generation API for the image agent.',
    plannedIn: 'File generation',
  },

  // Quality
  {
    name: 'Playwright',
    package: '@playwright/test',
    layer: 'quality',
    why: 'End-to-end tests in a real browser, run in CI with mock AI providers.',
    plannedIn: 'Launch',
  },
];

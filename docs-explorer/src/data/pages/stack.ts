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
          text: "A request goes from the browser to the Next.js server, then to the gateway, then to one service, which reads and writes its data stores. Today that path carries sign-in, logout, the profile and chats (the list and search, renaming, pinning and deleting, and each chat's history), end to end; agent and billing have no routes yet.",
        },
        {
          kind: 'list',
          items: [
            'Browser → Next.js server (port 3000): the browser only ever talks to the frontend app. Its chat data lives in a Redux store, fetched and cached with RTK Query.',
            "Next.js server → gateway (port 8000): the Next.js server forwards every `/api/*` call to the gateway (`forwardToGateway`), so backend addresses and secrets never reach the browser. Server components also call the gateway directly with the browser's cookie (`gatewayGet`), for the signed-in user and for a chat page.",
            'Gateway → services: the gateway checks the rate limits, its route table, the Origin and the session, then calls the service with fetch and a short-lived signed token: today auth (8001) and chat (8002), for the routes in its table. Agent (8003) and billing (8004) already refuse any call without a valid token; their routes come with their own features.',
            'Services → data stores: auth, chat, agent and billing connect to MongoDB at startup, and the gateway, auth and agent open a Redis client. Auth keeps its users in MongoDB and its sessions in Redis; chat keeps conversations and messages in MongoDB. Qdrant runs in Docker, but nothing connects to it yet. AWS S3 will hold files.',
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
        { component: 'qdrant' },
        { component: 's3' },
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
    why: "Checks data against schemas: each app's settings at startup (`loadEnv`), and request input with `validate`, which auth's and chat's routes use.",
  },
  {
    name: 'jose',
    layer: 'backend',
    why: 'Signs and checks the short-lived internal tokens between the gateway and services, and makes the private key that `pnpm setup:keys` writes when the gateway has none. The gateway signs a token with it for every request it forwards, and auth, chat, agent and billing check them.',
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
    name: 'pino-pretty',
    layer: 'backend',
    why: 'Turns log lines into colored, readable text when an app runs in development.',
  },

  // Data
  {
    name: 'mongoose',
    layer: 'data',
    why: 'Connects the services to MongoDB (`connectMongo`) and checks the connection for `/readyz` (`pingMongo`). Auth defines its users model with it, and chat its conversations and messages models. The shared library re-exports it, so every app uses one copy and the connection `connectMongo` opens.',
  },
  {
    name: 'ioredis',
    layer: 'data',
    why: 'The Redis client. `createRedis` makes one for the gateway, auth and agent, and `pingRedis` checks it for `/readyz`. The shared sessions and rate limits use it too: auth creates and deletes sessions, and the gateway looks them up and counts requests. Their tests run against a real Redis.',
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
    name: 'LangGraph',
    package: '@langchain/langgraph',
    layer: 'ai',
    why: 'Runs the agents: picks the agent for each message and runs its steps.',
    plannedIn: 'AI answers',
  },
  {
    name: 'Groq',
    layer: 'ai',
    why: 'Hosted language models. The main provider: it writes chat answers and the text for most other agents.',
    plannedIn: 'AI answers',
  },
  {
    name: 'OpenRouter',
    layer: 'ai',
    why: 'One API for many language models. The code agent will use it.',
    plannedIn: 'AI answers',
  },
  {
    name: 'Gemini',
    layer: 'ai',
    why: "Google's models. Part of the model providers, and later also used for PDF embeddings and questions about images (PDF and image Q&A).",
    plannedIn: 'AI answers',
  },
  {
    name: 'Tavily',
    layer: 'ai',
    why: 'A web search API that gives the search agent its sources.',
    plannedIn: 'Web search and code',
  },
  {
    name: 'Pollinations',
    layer: 'ai',
    why: 'An image generation API for the image agent.',
    plannedIn: 'File generation',
  },

  // Data
  {
    name: 'Qdrant client',
    package: '@qdrant/js-client-rest',
    layer: 'data',
    why: 'Stores and searches the vectors of uploaded PDFs in Qdrant, which already runs in Docker.',
    plannedIn: 'PDF and image Q&A',
  },
  {
    name: 'AWS S3 client',
    package: '@aws-sdk/client-s3',
    layer: 'data',
    why: 'Stores uploaded and generated files in AWS S3, even in development.',
    plannedIn: 'PDF and image Q&A',
  },

  // Payments
  {
    name: 'Razorpay',
    package: 'razorpay',
    layer: 'payments',
    why: 'Sells credit plans, in test mode. Payment results come back by webhook.',
    plannedIn: 'Payments and usage',
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

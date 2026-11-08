import type { DocPage } from '../schema.ts';

export const decisionsPage: DocPage = {
  id: 'decisions',
  title: 'Architecture decisions',
  summary:
    'The main choices behind the codebase, why they were made, what they cost, and where they show in the code.',
  sections: [
    {
      id: 'gateway-and-services',
      title: 'One gateway in front of separate services',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The backend is five separate apps, each its own Node process on its own port: the gateway (8000) and the auth, chat, agent and billing services (8001 to 8004). The gateway is meant to be the only public way in.',
            },
            {
              label: 'Why',
              text: 'Each service owns one area (sign-in, chats, AI agents, credits) and its own database, so it can change and restart on its own. Checks every request needs, such as sessions and rate limits, live in one place: the gateway.',
            },
            {
              label: 'Trade-off',
              text: 'More processes to run, and an extra network hop for each request. Calls between apps need their own authentication (see the internal tokens below).',
            },
          ],
        },
        {
          kind: 'text',
          text: 'Built today: the gateway checks every /api request (rate limits, its route table, the Origin and the session) and forwards the sign-in, logout and /me routes to auth with a signed internal token. Every service turns on the internal-token check, so a direct call to any service path except the health checks gets 401, even though each service listens on its own port. The route table has no routes for chat, agent or billing yet: each comes with its own feature (Chats, AI answers, Credits).',
        },
        {
          kind: 'quote',
          file: 'pnpm-workspace.yaml',
          text: '  - backend/gateway\n  - backend/services/*',
          caption: 'The gateway and the services are separate apps in the workspace',
        },
      ],
      refs: [
        { component: 'gateway' },
        { component: 'auth' },
        { component: 'chat' },
        { component: 'agent' },
        { component: 'billing' },
        { symbol: 'backend/gateway/src/app.ts#createApp' },
        { symbol: 'backend/gateway/src/route-table.ts#PUBLIC_ROUTES' },
        { flow: 'read-profile' },
        { flow: 'direct-service-call' },
      ],
    },
    {
      id: 'shared-library',
      title: 'A shared toolkit for every backend app',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'What the backend apps have in common lives in one library, `@gilder/shared`: settings, logging, errors, request IDs, health checks, database connections, startup and shutdown, internal tokens, sessions and rate limits.',
            },
            {
              label: 'Why',
              text: "All five apps start, log, check health and fail in the same way, and a fix in one place reaches every app. Each app's own code stays small: chat, agent and billing are just `env.ts`, `app.ts` and `index.ts`; auth adds its settings rules (`env-schema.ts`), its users model, its Google sign-in check and its routes; and the gateway adds its settings rules, its route table, its checks and its proxy.",
            },
            {
              label: 'Trade-off',
              text: 'A change to the library affects every app at once, so the library has its own tests. It is not compiled or published: the apps import its TypeScript source straight from the workspace.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/gateway/package.json',
          text: '"@gilder/shared": "workspace:*",',
          caption: 'Every backend app depends on the workspace copy of the library',
        },
      ],
      refs: [
        { component: 'shared' },
        { symbol: 'backend/shared/src/service.ts#createService' },
        { symbol: 'backend/shared/src/service.ts#startService' },
        { symbol: 'backend/shared/src/env.ts#loadEnv' },
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
      ],
    },
    {
      id: 'internal-tokens',
      title: 'Short-lived tokens between the gateway and services',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'For each request it forwards, the gateway signs a token (a JWT) addressed to the target service that expires after 60 seconds. A valid token proves the request came through the gateway; its subject, when present, is the signed-in user. Requests with no session, such as a sign-in, get a token without a user. A service accepts a request only with a valid token addressed to it, and routes that act for a user also need the token to name one.',
            },
            {
              label: 'Why',
              text: 'A plain user-ID header is not enough: anything that can reach a service could claim to be any user. A signed token proves the request came through the gateway.',
            },
            {
              label: 'Trade-off',
              text: 'Each forwarded call costs one signature and one check, and a key pair has to be managed: the private key only on the gateway, the public key on every service. `pnpm setup:keys` writes both into the `.env` files without printing them, and `--rotate` makes a new pair.',
            },
          ],
        },
        {
          kind: 'text',
          text: "Both sides are wired. The gateway imports `INTERNAL_PRIVATE_KEY` with `importInternalPrivateKey` (its settings check makes sure it is an Ed25519 key), and `proxyToService` calls `signInternalToken` for every request it forwards: the audience is the service, the subject is the user from the session, and `rid` is the request ID. Auth, chat, agent and billing import `INTERNAL_PUBLIC_KEY` with `importInternalPublicKey` and pass `createService` the `internalAuth` option, which puts `requireInternalToken` (with `verifyInternalToken`) in front of every route except `/healthz` and `/readyz`. Auth's routes that act for a user add `requireUser`. A missing, garbage, forged, misaddressed or expired token gets 401 (SEC-02).",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/internalToken.ts',
          text: '  audience: string,\n  claims: InternalTokenClaims,\n  ttlSeconds = 60,',
          caption: 'signInternalToken: a token lasts 60 seconds unless told otherwise',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/internalToken.ts#signInternalToken' },
        { symbol: 'backend/shared/src/internalToken.ts#verifyInternalToken' },
        { symbol: 'backend/shared/src/internalToken.ts#requireInternalToken' },
        { symbol: 'backend/shared/src/internalToken.ts#requireUser' },
        { symbol: 'backend/gateway/src/proxy.ts#proxyToService' },
        { symbol: 'backend/services/auth/src/app.ts#createApp' },
        { file: 'backend/shared/scripts/setup-keys.ts' },
        { component: 'gateway' },
        { component: 'auth' },
        { flow: 'direct-service-call' },
      ],
    },
    {
      id: 'route-allowlist',
      title: 'The gateway forwards only the routes it lists',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The gateway has a route table (`PUBLIC_ROUTES`): each public `/api` route names its service, the path to call there and whether a session is needed. A request that matches no entry gets the gateway's own 404 and never reaches a service.",
            },
            {
              label: 'Why',
              text: "Services have routes meant only for other services, such as auth's `GET /internal/users/:id`. With an allowlist, a new service route is unreachable from outside until someone adds it to the table on purpose. Route params must be 1 to 64 letters, digits, `-` or `_`, so `..` or an encoded slash cannot change the service path.",
            },
            {
              label: 'Trade-off',
              text: 'Every new public route has to be added in two places: the service and the table.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'The table lists only the auth routes today. The gateway tests and journey.test.ts check that internal paths, such as `/api/internal/users/<id>`, get 404 without reaching a service (SEC-01).',
        },
        {
          kind: 'quote',
          file: 'backend/gateway/src/route-table.ts',
          text: "  { method: 'GET', path: '/api/me', service: 'auth', target: '/me', session: 'required' },",
          caption: 'One entry of PUBLIC_ROUTES',
        },
      ],
      refs: [
        { symbol: 'backend/gateway/src/route-table.ts#PUBLIC_ROUTES' },
        { symbol: 'backend/gateway/src/route-table.ts#matchRoute' },
        { symbol: 'backend/gateway/src/app.ts#createApp' },
        { flow: 'unknown-route' },
      ],
    },
    {
      id: 'csrf-origin-check',
      title: 'Requests that change something must come from the app',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The session cookie is `SameSite=Lax`, and on top of that the gateway refuses any request other than GET, HEAD or OPTIONS unless its `Origin` header is one of the `FRONTEND_ORIGIN` origins (`originCheck`), with 403.',
            },
            {
              label: 'Why',
              text: "A cookie goes along with requests the browser sends, even ones another site starts. Browsers set `Origin` themselves and pages cannot change it, so checking it stops a form or script on another site from acting with the user's session (cross-site request forgery).",
            },
            {
              label: 'Trade-off',
              text: 'Every client that changes something must send an allowed `Origin`, including tools and tests, and each frontend address has to be listed in `FRONTEND_ORIGIN`, which takes several origins separated by commas.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/gateway/src/guards.ts',
          text: 'if (!origin || !allowedOrigins.includes(origin)) {',
          caption: 'originCheck: a missing Origin is refused too',
        },
      ],
      refs: [
        { symbol: 'backend/gateway/src/guards.ts#originCheck' },
        { symbol: 'backend/gateway/src/env-schema.ts#gatewayEnvSchema' },
        { symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter' },
        { flow: 'logout' },
      ],
    },
    {
      id: 'rate-limits',
      title: 'Rate limits per IP address and per user, counted in Redis',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The gateway allows 120 requests a minute from one IP address and 60 from one signed-in user. Counts live in Redis in fixed one-minute windows; over a limit, the answer is 429 with `Retry-After`.',
            },
            {
              label: 'Why',
              text: 'Counting in Redis means every copy of the gateway shares the same counts. The per-IP limit covers everyone, signed in or not; the per-user limit holds one account to its share however many devices or addresses it uses.',
            },
            {
              label: 'Trade-off',
              text: "A fixed window lets a client send up to twice the limit around the moment one window ends and the next starts. If Redis fails, the request gets a 500: it is refused, not let through. The client's address comes from `X-Forwarded-For` across `TRUST_PROXY_HOPS` proxies, so that number must match how the gateway is deployed.",
            },
          ],
        },
        {
          kind: 'text',
          text: 'The per-IP limit runs first, for every request that reaches the `/api` router, including paths the gateway does not forward. The per-user limit runs after the session lookup, so a request without a session is counted only per IP. The per-agent limits in the shared constants are not used yet.',
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/constants.ts',
          text: 'export const GATEWAY_RATE_LIMITS = { perIp: 120, perUser: 60 } as const;',
        },
      ],
      refs: [
        { symbol: 'backend/gateway/src/guards.ts#ipRateLimit' },
        { symbol: 'backend/gateway/src/guards.ts#userRateLimit' },
        { symbol: 'backend/shared/src/rateLimit.ts#rateLimit' },
        { symbol: 'backend/shared/src/rateLimit.ts#hitRateLimit' },
        { symbol: 'backend/shared/src/constants.ts#GATEWAY_RATE_LIMITS' },
      ],
    },
    {
      id: 'typescript-on-node',
      title: 'TypeScript runs directly on Node 22',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The backend has no build step. Node 22 strips the types and runs each app's `src/index.ts` as it is.",
            },
            {
              label: 'Why',
              text: 'There is nothing to compile or keep in sync: what runs is exactly the source in the repo, and `node --watch` restarts an app as soon as a file changes.',
            },
            {
              label: 'Trade-off',
              text: 'Node does not check types, so type errors are caught only by `pnpm typecheck` (`tsc --noEmit`), the editor and CI. Only TypeScript that can be erased is allowed (`erasableSyntaxOnly`): no enums and no constructor parameter properties. Imports name the `.ts` file.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/gateway/package.json',
          text: '"start": "node --env-file-if-exists=.env src/index.ts",',
          caption: 'Each backend app starts by running its TypeScript entry file with Node',
        },
      ],
      refs: [
        { file: '.nvmrc' },
        { file: 'tsconfig.base.json' },
        { file: 'backend/gateway/package.json' },
        { flow: 'app-startup' },
      ],
    },
    {
      id: 'mongo-replica-set',
      title: 'MongoDB runs as a single-node replica set',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Even locally, MongoDB runs as a replica set named `rs0` with one member.',
            },
            {
              label: 'Why',
              text: 'MongoDB transactions only work on a replica set. The planned credits ledger will need them: a balance change and its ledger entry must be saved together or not at all.',
            },
            {
              label: 'Trade-off',
              text: 'A little more setup: the Docker health check creates the replica set on the first run. Its one member advertises its address inside the container, `localhost:27017`, but from the host the database is on port 27018. So the connection strings must set `directConnection=true`: the driver then stays on the address it was given instead of switching to the one the member advertises.',
            },
          ],
        },
        {
          kind: 'text',
          text: "No app uses a transaction yet; the ledger comes with Credits. The shared library's tests already run a real in-memory replica set and check that a transaction commits, and rolls back every write when it fails.",
        },
        {
          kind: 'quote',
          file: 'backend/docker-compose.yml',
          text: "command: ['--replSet', 'rs0', '--bind_ip_all']",
          caption: 'The mongo service in Docker Compose',
        },
      ],
      refs: [
        { component: 'mongodb' },
        { file: 'backend/docker-compose.yml' },
        { file: 'backend/shared/src/mongo.test.ts' },
        { symbol: 'backend/shared/src/mongo.ts#connectMongo' },
      ],
    },
    {
      id: 'redis-noeviction',
      title: 'Redis never drops keys on its own',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Redis runs with the `noeviction` policy, and every key the apps write must have an expiry time (TTL).',
            },
            {
              label: 'Why',
              text: 'Sessions live in Redis. With an eviction policy, a full Redis would quietly delete keys and sign users out at random. With `noeviction` it refuses new writes instead, and TTLs stop old keys from filling it up.',
            },
            {
              label: 'Trade-off',
              text: 'If memory does fill up, writes fail with an error. A key written without a TTL never goes away, so nothing else frees the space.',
            },
          ],
        },
        {
          kind: 'text',
          text: "The policy is set in Docker Compose. The shared code sets a TTL on every key it writes: a session (`sess:` and the SHA-256 of its ID) lasts 7 days, renewed on each lookup, and a rate-limit counter (`rl:<scope>:<id>`) gets its expiry in the same MULTI as its count. Auth's sign-in writes sessions and its logout deletes them; the gateway renews a session on each lookup and counts every request per IP and per signed-in user. No memory limit (`--maxmemory`) is set, so the policy does not come into play today.",
        },
        {
          kind: 'quote',
          file: 'backend/docker-compose.yml',
          text: "# noeviction: sessions must never be silently dropped; every key has a TTL instead.\n    command: ['redis-server', '--appendonly', 'yes', '--maxmemory-policy', 'noeviction']",
          caption: 'The redis service in Docker Compose',
        },
      ],
      refs: [
        { component: 'redis' },
        { file: 'backend/docker-compose.yml' },
        { symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter' },
        { symbol: 'backend/shared/src/sessions.ts#createSession' },
        { symbol: 'backend/shared/src/sessions.ts#resolveSession' },
        { symbol: 'backend/shared/src/rateLimit.ts#hitRateLimit' },
      ],
    },
    {
      id: 'request-ids',
      title: 'A request ID on every line written during a request',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Every request gets an ID: the caller's `X-Request-Id` when it looks safe, or a new UUID. It is sent back in the `X-Request-Id` response header, put in error bodies and added to every log line written during the request.",
            },
            {
              label: 'Why',
              text: 'One ID ties a response to its log lines: a user can quote it, and a developer can find what happened. Passed from app to app, it follows one request through the gateway and a service.',
            },
            {
              label: 'Trade-off',
              text: "The ID travels through async code in Node's `AsyncLocalStorage`, which costs a little on every request. A caller can choose its own ID, so IDs are not guaranteed to be unique. Only 8 to 128 letters, digits, `_`, `.` or `-` are accepted, so a caller cannot slip fake text into the logs.",
            },
          ],
        },
        {
          kind: 'text',
          text: "The gateway passes its ID on: `proxyToService` sends it in `X-Request-Id` and in the internal token's `rid`, and the service's `requestId` middleware reuses it, so the gateway and auth log the same ID for one request. The frontend does not send one yet.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/requestId.ts',
          text: '    res.setHeader(REQUEST_ID_HEADER, id);\n    runWithContext({ requestId: id }, next);',
          caption: 'requestId(): echo the ID, then run the rest of the request inside its context',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/requestId.ts#requestId' },
        { symbol: 'backend/shared/src/context.ts#runWithContext' },
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
        { symbol: 'backend/shared/src/errors.ts#toProblem' },
        { flow: 'unknown-route' },
      ],
    },
    {
      id: 'local-ports',
      title: 'Non-standard local ports',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The local data stores use host ports that are not their defaults: MongoDB 27018, Redis 6380 and Qdrant 6335.',
            },
            {
              label: 'Why',
              text: 'So GilderAi can run next to other local projects that already use 27017, 6379 or 6333.',
            },
            {
              label: 'Trade-off',
              text: "Tools such as `mongosh` and `redis-cli` must be given the port. The ports can be changed with `MONGO_PORT`, `REDIS_PORT` and `QDRANT_PORT` when Docker Compose starts, but then the apps' connection settings must change too.",
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/docker-compose.yml',
          text: '# Host ports avoid the defaults (27017 / 6379 / 6333) so GilderAi can run next to other local projects.',
        },
      ],
      refs: [
        { file: 'backend/docker-compose.yml' },
        { component: 'mongodb' },
        { component: 'redis' },
        { component: 'qdrant' },
      ],
    },
    {
      id: 'zod-at-the-edges',
      title: 'Zod checks data where it comes in',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Data from outside the code is checked with Zod schemas where it enters: settings when an app starts (`loadEnv`), and request params, query and body before a route runs (`validate`).',
            },
            {
              label: 'Why',
              text: 'Bad input is stopped at the door with a clear message, and the code behind it gets typed, converted values, such as the number 8000 instead of the text "8000".',
            },
            {
              label: 'Trade-off',
              text: 'Every app has to write its schemas. `validate` replaces the request parts with the parsed values, so a route sees only what its schema keeps.',
            },
          ],
        },
        {
          kind: 'text',
          text: "Both are wired. Every app's `env.ts` calls `loadEnv`, and a bad setting stops the app at startup. Auth's routes check their input with `validate`: the sign-in bodies, the `PATCH /me` body and the user ID in `GET /internal/users/:id`.",
        },
        {
          kind: 'quote',
          file: 'backend/gateway/src/env-schema.ts',
          text: '  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),',
          caption:
            "One of the gateway's settings: a whole number from 0 to 5, 1 when it is not set",
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/env.ts#loadEnv' },
        { symbol: 'backend/shared/src/env.ts#baseEnvSchema' },
        { symbol: 'backend/gateway/src/env-schema.ts#gatewayEnvSchema' },
        { symbol: 'backend/shared/src/validate.ts#validate' },
        { symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter' },
        { flow: 'app-startup' },
      ],
    },
    {
      id: 'server-side-proxy',
      title: 'Secrets stay on servers',
      status: 'planned',
      plannedIn: 'Sign-in page and app shell',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The browser will talk only to the Next.js app. Its server will forward every `/api/*` call to the gateway.',
            },
            {
              label: 'Why',
              text: 'Backend addresses, keys and internal tokens never reach the browser. It only gets values that are safe to be public.',
            },
            {
              label: 'Trade-off',
              text: 'Every API call takes one more hop through the Next.js server, and streamed answers must pass through it too.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'Not built yet: the frontend is still the starter page and makes no API calls.',
        },
      ],
      refs: [{ component: 'browser' }, { component: 'frontend' }, { component: 'gateway' }],
    },
  ],
};

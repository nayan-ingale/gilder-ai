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
          text: 'Built today: the gateway checks every /api request (rate limits, its route table, the Origin and the session) and forwards the sign-in, logout and /me routes to auth, the chat routes to chat, the answer routes to the agent and the balance to billing, each with a signed internal token. Every service turns on the internal-token check, so a direct call to any service path except the health checks gets 401, even though each service listens on its own port. Services also call each other directly, each with its own key: auth calls billing, and the agent calls chat and billing.',
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
        { flow: 'list-chats' },
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
              text: "All five apps start, log, check health and fail in the same way, and a fix in one place reaches every app. Each app's own code stays small: auth adds its settings rules (`env-schema.ts`), its users model, its Google sign-in check, its routes and its call to billing; chat adds its models and its two routers; billing its models, its credit functions, its routes and the sweeper; the agent its AI layer, routing, memory and turn route; and the gateway adds its settings rules, its route table, its checks and its proxy.",
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
          text: 'Both sides are wired. The gateway imports `INTERNAL_PRIVATE_KEY` with `importInternalPrivateKey` (its settings check makes sure it is an Ed25519 key), and `proxyToService` calls `signInternalToken` for every request it forwards: the audience is the service, the subject is the user from the session, and `rid` is the request ID. Auth, chat, agent and billing import `INTERNAL_PUBLIC_KEY` with `importInternalPublicKey` and pass `createService` the `internalAuth` option, which puts `requireInternalToken` (with `verifyInternalToken`) in front of every route except `/healthz` and `/readyz`. Routes that act for a user add `requireUser`. A missing, garbage, forged, misaddressed or expired token gets 401 (SEC-02). Auth and the agent sign their own calls to other services the same way, each with its own key (see the next decision).',
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
      id: 'service-keys',
      title: 'Each service that calls another signs with its own key',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Auth and the agent each have their own signing key (`SERVICE_PRIVATE_KEY`). A token names its signer in its issuer (gilder-gateway, gilder-auth or gilder-agent); a service checks it with that signer's public key, and only for the signers it trusts: chat trusts the gateway and the agent, billing the gateway, auth and the agent. Each internal route names the one service allowed to call it (`requireCaller`).",
            },
            {
              label: 'Why',
              text: "Sharing the gateway's key would let any service act as the gateway, and any other service's route would be open to it. With a key per signer, a leaked agent key cannot hand out sign-up credits, auth's key cannot charge credits, and neither can reach a route through the gateway's door.",
            },
            {
              label: 'Trade-off',
              text: 'Three key pairs to manage instead of one, and each receiver needs the right public keys. `pnpm setup:keys` writes them all, and each app refuses to start without the keys it needs.',
            },
          ],
        },
        {
          kind: 'text',
          text: "`createInternalClient` signs every call with the caller's key, for the user the call is for and with the current request ID, and gives up after 5 seconds. The internalToken tests check that a service's token passes only where that service is trusted, and that no key can pass for another; credits.test.ts and the chat and billing route tests check that the wrong signer gets 403 on an internal route.",
        },
        {
          kind: 'quote',
          file: 'backend/shared/src/internalToken.ts',
          text: "export const INTERNAL_CALLERS = ['gateway', 'auth', 'agent'] as const;",
          caption: 'Who can sign internal tokens',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/internalToken.ts#INTERNAL_CALLERS' },
        { symbol: 'backend/shared/src/internalToken.ts#verifyInternalToken' },
        { symbol: 'backend/shared/src/internalToken.ts#requireCaller' },
        { symbol: 'backend/shared/src/internalClient.ts#createInternalClient' },
        { file: 'backend/shared/scripts/setup-keys.ts' },
        { flow: 'signup-grant' },
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
              text: "Services have routes meant only for other services, such as auth's `GET /internal/users/:id` and chat's `/internal` routes for the agent service. With an allowlist, a new service route is unreachable from outside until someone adds it to the table on purpose. Route params must be 1 to 64 letters, digits, `-` or `_`, so `..` or an encoded slash cannot change the service path.",
            },
            {
              label: 'Trade-off',
              text: 'Every new public route has to be added in two places: the service and the table.',
            },
          ],
        },
        {
          kind: 'text',
          text: "The table lists the auth and chat routes, the answer routes (send, regenerate, edit and stop) and `GET /api/billing/account` today; each of those needs a session, and `/api/chats/:id/messages` becomes the agent's `/chats/<id>/turns`. The gateway tests and journey.test.ts check that internal paths, such as `/api/internal/users/<id>`, `/api/internal/messages` and `/api/internal/accounts`, get 404 without reaching a service (SEC-01).",
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
          text: 'The per-IP limit runs first, for every request that reaches the `/api` router, including paths the gateway does not forward. The per-user limit runs after the session lookup, so a request without a session is counted only per IP. Answers have a third limit, per agent, in the agent service (see below).',
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
              text: 'MongoDB transactions only work on a replica set. The credits ledger needs them: a balance change and its ledger entry must be saved together or not at all.',
            },
            {
              label: 'Trade-off',
              text: 'A little more setup: the Docker health check creates the replica set on the first run. Its one member advertises its address inside the container, `localhost:27017`, but from the host the database is on port 27018. So the connection strings must set `directConnection=true`: the driver then stays on the address it was given instead of switching to the one the member advertises.',
            },
          ],
        },
        {
          kind: 'text',
          text: "Billing runs every credit change in a transaction (`inTransaction`): the sign-up grant with its ledger entry, a hold with its balance change, a commit with its usage entry and a release with its refund. Its tests, the agent's turn tests and journey.test.ts start a one-member replica set in memory (`startTestMongo({ replicaSet: true })`), and the shared library's tests check that a transaction commits, and rolls back every write when it fails.",
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
          text: "The policy is set in Docker Compose. The shared code sets a TTL on every key it writes: a session (`sess:` and the SHA-256 of its ID) lasts 7 days, renewed on each lookup, and a rate-limit counter (`rl:<scope>:<id>`) gets its expiry in the same MULTI as its count. Auth's sign-in writes sessions and its logout deletes them; the gateway renews a session on each lookup and counts every request per IP and per signed-in user. The agent's chat memory (`mem:<chat ID>`) expires after an hour, its per-request lock (`turn-lock:...`) and its stop registration (`turn:<turn ID>`) after 15 minutes, and its per-agent counters (`rl:agent-...`) with their minute. Stop messages travel on a channel and are never stored. No memory limit (`--maxmemory`) is set, so the policy does not come into play today.",
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
          text: "The gateway passes its ID on: `proxyToService` sends it in `X-Request-Id` and in the internal token's `rid`, and the service's `requestId` middleware reuses it, so the gateway and the service log the same ID for one request. The Next.js proxy (`forwardToGateway`) sends one with every `/api` call it forwards and passes it back to the browser, where a failed chat change shows it in a toast. Server components' own calls (`gatewayGet`) send none, so the gateway makes one. When auth or the agent calls another service, `createInternalClient` sends the current ID along too.",
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
          text: "Both are wired. Every app's `env.ts` calls `loadEnv`, and a bad setting stops the app at startup. Auth's routes check their input with `validate`: the sign-in bodies, the `PATCH /me` body and the user ID in `GET /internal/users/:id`. So do chat's (the chat ID, the list's query, cursor and limit), billing's and the agent's turn route, with bodies that refuse any field they do not list. The router model's reply is checked the same way (`completeJson`), with one repair before it counts as a failure.",
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
        { symbol: 'backend/services/chat/src/chat-routes.ts#chatRouter' },
        { flow: 'app-startup' },
      ],
    },
    {
      id: 'server-side-proxy',
      title: 'Secrets stay on servers',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The browser talks only to the Next.js app. Its server forwards every `/api/*` call to the gateway, and server components call the gateway directly with the browser's cookie.",
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
          text: "The `/api/[...path]` route forwards with `forwardToGateway`. On the server, `gatewayGet` calls the gateway with the browser's cookie: `getCurrentUser` asks for `/api/me`, and `getChatWithHistory` for a chat and its messages, so the chat page renders its history on the server. `GATEWAY_URL` is a server-only setting; the browser gets only `NEXT_PUBLIC_*` values, which are public by design.",
        },
      ],
      refs: [
        { component: 'browser' },
        { component: 'frontend' },
        { component: 'gateway' },
        { symbol: 'frontend/src/server/gateway-proxy.ts#forwardToGateway' },
        { symbol: 'frontend/src/server/session.ts#getCurrentUser' },
        { symbol: 'frontend/src/server/gateway-fetch.ts#gatewayGet' },
        { symbol: 'frontend/src/server/chats.ts#getChatWithHistory' },
        { flow: 'open-chat' },
      ],
    },
    {
      id: 'chat-list-cursor',
      title: 'Chat lists page with a cursor, not page numbers',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "`GET /chats` returns every pinned chat (latest pin first) on the first page, then the others by `lastMessageAt`, newest first, with `_id` as the tie-break. The next page starts after a cursor: base64url JSON of the last chat's time and ID. A chat's history pages the same way, newest first, each page returned oldest first. Search (`?query=`) matches titles and message text through MongoDB text indexes that start with `userId`, and returns one page with no cursor.",
            },
            {
              label: 'Why',
              text: 'A cursor stays right while chats move: a new message moves a chat to the top, which would shift page numbers and repeat or skip chats. Two chats can have the same `lastMessageAt`; the `_id` tie-break makes the order total, so none is skipped or shown twice. The cursor is opaque, and the service refuses one it did not make.',
            },
            {
              label: 'Trade-off',
              text: 'A client cannot jump to a page, only go on from where it is. Pinned chats all come on the first page (up to 50). Search returns at most one page and finds whole words, not parts of words.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'The `{ userId, pinnedAt, lastMessageAt }` index serves the list. chat-routes.test.ts pages through chats with equal times and checks that each comes once, and that a cursor the service did not make gets 400.',
        },
        {
          kind: 'quote',
          file: 'backend/services/chat/src/chat-routes.ts',
          text: '{ lastMessageAt: new Date(after.at), _id: { $lt: after.id } },',
          caption: 'The next page: an older time, or the same time and a smaller ID',
        },
      ],
      refs: [
        { component: 'chat' },
        { symbol: 'backend/services/chat/src/chat-routes.ts#chatRouter' },
        { symbol: 'backend/services/chat/src/chat-routes.ts#encodeCursor' },
        { symbol: 'backend/services/chat/src/chat-routes.ts#decodeCursor' },
        { symbol: 'backend/services/chat/src/models.ts#conversationSchema' },
        { flow: 'list-chats' },
      ],
    },
    {
      id: 'soft-delete',
      title: 'Deleting a chat is a soft delete',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: '`DELETE /chats/:id` sets `deletedAt` on the chat; nothing is removed. Every chat query filters on `deletedAt: null`.',
            },
            {
              label: 'Why',
              text: 'One write, and the chat leaves every list, search and read at once. Its messages stay for a later clean-up job instead of a slow delete during the request.',
            },
            {
              label: 'Trade-off',
              text: "Deleted chats and their messages stay in the database until that clean-up exists, and it is not built yet; only the chat's files are removed today, by the agent's file clean-up. Every new query must keep the `deletedAt: null` filter: findOwnedConversation has it for every route about one chat, and message search loads the chats again to drop deleted ones.",
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/chat/src/chat-routes.ts',
          text: 'chat.deletedAt = new Date();',
          caption: 'DELETE /chats/:id',
        },
      ],
      refs: [
        { symbol: 'backend/services/chat/src/chat-routes.ts#chatRouter' },
        { symbol: 'backend/services/chat/src/models.ts#findOwnedConversation' },
        { flow: 'delete-chat' },
      ],
    },
    {
      id: 'not-yours-404',
      title: "Another user's chat gets the same 404 as a missing one",
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Every lookup of a chat or a message filters by the user in the internal token. Someone else's chat, a deleted chat, an unknown ID and an ID that is not an ObjectId all get the same 404 'No such chat'. The chat page shows one 'This chat isn't available' page for all of them.",
            },
            {
              label: 'Why',
              text: "A 403 for someone else's chat would confirm that the ID exists. With the owner in the query itself, no route can read a chat first and forget to check it.",
            },
            {
              label: 'Trade-off',
              text: "A user who opens a link to someone else's chat is not told why it is not available, and finding out means reading the logs by request ID.",
            },
          ],
        },
        {
          kind: 'text',
          text: "chat-routes.test.ts checks GET, PATCH and DELETE `/chats/:id` and the history with another user's chat, a missing ID and `not-an-id`, and journey.test.ts checks every route again through the real gateway (SEC-04).",
        },
        {
          kind: 'quote',
          file: 'backend/services/chat/src/models.ts',
          text: 'return ConversationModel.findOne({ _id: conversationId, userId, deletedAt: null });',
          caption: 'findOwnedConversation: the owner is part of the query',
        },
      ],
      refs: [
        { symbol: 'backend/services/chat/src/models.ts#findOwnedConversation' },
        { symbol: 'backend/services/chat/src/chat-routes.ts#ownedOr404' },
        { symbol: 'frontend/src/app/(app)/c/[chatId]/not-found.tsx#ChatNotFound' },
        { flow: 'chat-not-yours' },
      ],
    },
    {
      id: 'idempotent-messages',
      title: 'Saving the same message twice keeps one copy',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'A message can carry an ID chosen by its sender (`clientMessageId`). `POST /internal/messages` saves a message once per chat and client ID: the first call answers 201, and a repeat answers 200 with the same message and `created: false`. A unique index on `{ conversationId, clientMessageId }` holds even when two copies arrive at the same moment.',
            },
            {
              label: 'Why',
              text: 'A send can be retried after a timeout or a dropped connection without saving the message twice. A read before the insert handles the usual retry; the unique index handles a race, where the losing insert fails and returns the winner.',
            },
            {
              label: 'Trade-off',
              text: 'One extra read before each save, and a sender must keep the same ID across retries. Messages without a client ID, such as answers, are not limited.',
            },
          ],
        },
        {
          kind: 'text',
          text: "internal-routes.test.ts sends the same message three times at once and gets one 201, two 200s and one stored message. The agent's turn route uses it: it saves the user's message with the clientMessageId its request carries, and retries such a save safely.",
        },
        {
          kind: 'quote',
          file: 'backend/services/chat/src/models.ts',
          text: "{ unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },",
          caption: 'The unique index covers only messages that have a client ID',
        },
      ],
      refs: [
        { symbol: 'backend/services/chat/src/internal-routes.ts#internalRouter' },
        { symbol: 'backend/services/chat/src/models.ts#messageSchema' },
      ],
    },
    {
      id: 'auto-title',
      title: "A chat is auto-titled only while it is still 'New chat'",
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "`PATCH /internal/chats/:id` sets a chat's title only while the title is still 'New chat' (`DEFAULT_CHAT_TITLE`), and answers whether it renamed it.",
            },
            {
              label: 'Why',
              text: 'The title is to be written after the first answer, which can arrive after the user has already renamed the chat. Checking the current title means a rename by the user always wins.',
            },
            {
              label: 'Trade-off',
              text: "A chat the user renamed to exactly 'New chat' can still be auto-titled.",
            },
          ],
        },
        {
          kind: 'text',
          text: 'internal-routes.test.ts checks that a second auto-title leaves the first one in place. The agent writes the title while the first answer streams and sends it as a title event, which the turn test checks.',
        },
        {
          kind: 'quote',
          file: 'backend/services/chat/src/internal-routes.ts',
          text: 'const renamed = chat.title === DEFAULT_CHAT_TITLE;',
        },
      ],
      refs: [
        { symbol: 'backend/services/chat/src/internal-routes.ts#internalRouter' },
        { symbol: 'backend/services/chat/src/models.ts#DEFAULT_CHAT_TITLE' },
      ],
    },
    {
      id: 'new-chat-first-message',
      title: 'A new chat is created by its first message',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'New chat (the sidebar button, the + in the small-screen bar and ⌘⇧O) opens `/` and creates nothing. The chat is created when its first message is sent; `POST /api/chats` is in place for that.',
            },
            {
              label: 'Why',
              text: "Opening New chat and leaving again does not leave an empty 'New chat' behind, so the list holds only chats with something in them.",
            },
            {
              label: 'Trade-off',
              text: 'The page at `/` has no chat ID until the first message, so the first send has to create the chat and then move to its address.',
            },
          ],
        },
        {
          kind: 'text',
          text: "Every New chat link and the shortcut go to `/`. There, NewChatComposer creates the chat when the first message is sent, puts the message in the store's pending slice and opens `/c/<id>`, where the chat thread sends it once, so the answer streams on the chat's own address. chat-thread.test.tsx checks that the queued message is sent as soon as the chat opens.",
        },
        {
          kind: 'quote',
          file: 'frontend/src/components/chats/chat-commands.tsx',
          text: "        setSearchOpen(false);\n        router.push('/');",
          caption: '⌘⇧O: a new chat is just the page at /',
        },
      ],
      refs: [
        { symbol: 'frontend/src/components/app-shell/sidebar.tsx#SidebarFrame' },
        { symbol: 'frontend/src/components/chats/chat-commands.tsx#ChatCommands' },
        { symbol: 'frontend/src/app/(app)/page.tsx#NewChatPage' },
        { symbol: 'frontend/src/components/chat/new-chat.tsx#NewChatComposer' },
        { symbol: 'frontend/src/store/pending-slice.ts#pendingSlice' },
        { symbol: 'backend/services/chat/src/chat-routes.ts#chatRouter' },
        { flow: 'first-message' },
      ],
    },
    {
      id: 'client-data',
      title: 'RTK Query holds the chat data, and changes show at once',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The browser's chat data goes through RTK Query: an infinite query for the sidebar list, a separate query for search, and rename, pin and delete that change the cached list before the server answers and undo the change if the call fails.",
            },
            {
              label: 'Why',
              text: 'One cache feeds the sidebar, the small-screen panel and search, and lists refresh themselves after a change (tags). Optimistic changes make the menu feel instant, and the undo with a toast keeps the list true when the server refuses.',
            },
            {
              label: 'Trade-off',
              text: "Redux Toolkit adds weight to the browser bundle, and for a moment the list can show a change the server then refuses. The store needs care in Next.js: the root reducer is written by hand, because `combineReducers` calls `Math.random()`, which Next.js refuses while it prerenders, and Redux Toolkit's development checks run only in the browser.",
            },
          ],
        },
        {
          kind: 'text',
          text: "chats.test.tsx checks a rename, a delete of the open chat that goes back to a new chat, and a pin the server refuses: the chat leaves Pinned again and the toast shows 'No such chat'.",
        },
        {
          kind: 'quote',
          file: 'frontend/src/store/api.ts',
          text: "api.util.updateQueryData('listChats', undefined, (draft) => {",
          caption: 'updateChat and deleteChat change the cached list first',
        },
      ],
      refs: [
        { component: 'frontend' },
        { symbol: 'frontend/src/store/api.ts#api' },
        { symbol: 'frontend/src/store/store.tsx#makeStore' },
        { symbol: 'frontend/src/components/chats/chat-row.tsx#ChatRow' },
        { flow: 'update-chat' },
        { flow: 'delete-chat' },
      ],
    },
    {
      id: 'grant-on-sign-in',
      title: 'The sign-up grant is asked for on every sign-in',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Auth asks billing for the sign-up credits on every sign-in, not only a user's first. Billing grants once per user, and a billing failure never blocks the sign-in: auth logs a warning and goes on.",
            },
            {
              label: 'Why',
              text: 'Auth does not need to know whether billing has an account yet, and a user whose first grant failed because billing was down gets it on the next sign-in, without any repair job.',
            },
            {
              label: 'Trade-off',
              text: 'Every sign-in makes one more call, and waits up to 5 seconds (twice) when billing is down. Until the grant lands, the user has no account and the credits card shows 0.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'Billing makes the repeat harmless: a check for an earlier grant, and a partial unique index that allows one signup_grant ledger entry per user even when two sign-ins race. journey.test.ts signs in twice through the real gateway and sees a balance of exactly 100.',
        },
        {
          kind: 'quote',
          file: 'backend/services/auth/src/session-routes.ts',
          text: '// A billing outage must not stop sign-in: the grant is asked for again on the next one.',
        },
      ],
      refs: [
        { symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter' },
        { symbol: 'backend/services/auth/src/billing.ts#billingSignupGrant' },
        { symbol: 'backend/services/billing/src/credits.ts#grantSignupCredits' },
        { symbol: 'backend/services/billing/src/models.ts#ledgerSchema' },
        { flow: 'signup-grant' },
      ],
    },
    {
      id: 'reserve-one-update',
      title: "Credits are held with one conditional update, so they can't be overdrawn",
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Before the AI runs, the agent holds the answer's credits in billing. The hold is one findOneAndUpdate that lowers the balance only where `balance >= cost`, in a transaction with the new reservation. The price comes from CREDIT_COSTS for the agent, never from the caller. A finished answer commits the hold with a usage ledger entry; a failed one releases it.",
            },
            {
              label: 'Why',
              text: 'Reading the balance and then writing it would let two answers at once both see enough credits. With the check inside the update, MongoDB applies them one at a time, and the second simply matches nothing. An idempotency key per message makes a retried reserve hold once.',
            },
            {
              label: 'Trade-off',
              text: 'The credits are taken before anyone knows whether the answer will succeed, so a failure has to give them back; a hold that is never settled waits for the sweeper. Every price is fixed per agent, not per token.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'The SEC-08 test sends 50 reservations at once against 100 credits and gets exactly 10 holds, 40 refusals with 402 and a balance of 0. Every test checks the invariant: the balance equals the sum of the ledger minus the credits on hold.',
        },
        {
          kind: 'quote',
          file: 'backend/services/billing/src/credits.ts',
          text: '{ _id: userId, balance: { $gte: amount } },',
          caption: 'reserveCredits: the check and the decrease in one update',
        },
      ],
      refs: [
        { component: 'billing' },
        { symbol: 'backend/services/billing/src/credits.ts#reserveCredits' },
        { symbol: 'backend/services/billing/src/credits.ts#commitCredits' },
        { symbol: 'backend/services/billing/src/credits.ts#releaseCredits' },
        { symbol: 'backend/shared/src/constants.ts#CREDIT_COSTS' },
        { flow: 'run-turn' },
      ],
    },
    {
      id: 'stale-hold-sweeper',
      title: 'A sweeper gives back holds left behind',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Every minute, billing releases each hold that has been held for more than 10 minutes, one transaction per hold.',
            },
            {
              label: 'Why',
              text: "If the agent crashes mid-answer, or cannot reach billing to settle, the user's credits would stay held for good. Answers end long before 10 minutes, so only abandoned holds are that old.",
            },
            {
              label: 'Trade-off',
              text: 'A user can be short of those credits for up to about 11 minutes after a crash. An answer that really did run longer than 10 minutes would be released before its commit, and the commit would then be refused as a conflict.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'A hold is released only while it is still held, so several billing instances can sweep at once and each hold is given back exactly once; the test runs sweeps side by side. The timer never keeps the process alive and stops on shutdown.',
        },
        {
          kind: 'quote',
          file: 'backend/services/billing/src/sweeper.ts',
          text: 'export const STALE_RESERVATION_MS = 10 * 60 * 1000;',
        },
      ],
      refs: [
        { symbol: 'backend/services/billing/src/sweeper.ts#releaseStaleReservations' },
        { symbol: 'backend/services/billing/src/sweeper.ts#startReservationSweeper' },
        { symbol: 'backend/services/billing/src/credits.ts#releaseHeld' },
      ],
    },
    {
      id: 'balance-check-first',
      title: 'No credits, no AI call',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Before any AI call, the router's included, the turn route reads the user's balance and refuses with 402 when it is below the price of a chat answer. The chat ownership and the per-message lock are checked even earlier.",
            },
            {
              label: 'Why',
              text: 'Choosing the agent is free to the user but not to the server: a user with no credits must not be able to make the server call a model at all (SEC-03).',
            },
            {
              label: 'Trade-off',
              text: 'One extra call to billing per turn. The check is only a first filter: a user with a little credit left can pass it and still be refused by the hold, after the free router call, when the routed agent costs more.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'turns.test.ts sends a turn for a user with no account and checks the 402, that no AI call of any kind was made and that no message was saved.',
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/turns.ts',
          text: "// No credits at all: refuse before any AI call, the router's included.",
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/turns.ts#turnRouter' },
        { symbol: 'backend/services/agent/src/services.ts#billingService' },
        { flow: 'run-turn' },
      ],
    },
    {
      id: 'fetch-ai-layer',
      title: 'A small fetch-based AI layer instead of an SDK or agent framework',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The agent calls the AI providers through its own code: one streaming client for the OpenAI chat-completions API (which Groq, OpenRouter and Gemini all offer), a table of models per kind of call, a mock provider, JSON checked with Zod, and routing and the turn written as plain functions. No provider SDK and no agent framework such as LangChain.',
            },
            {
              label: 'Why',
              text: "The few things needed (streaming, token usage, timeouts, a fallback, structured output) fit in a few hundred lines that can be read and tested end to end. Credits, streaming to the browser and saving messages follow the app's own rules, which a framework would have to be bent around.",
            },
            {
              label: 'Trade-off',
              text: 'Features a framework would bring, such as tool calling or new provider quirks, have to be written by hand when they are needed. Only providers with an OpenAI-compatible API fit the one client.',
            },
          ],
        },
        {
          kind: 'text',
          text: '`LLM_MODE=mock`, the default, swaps in a mock provider that streams canned text, so the whole app, its tests and CI run without any AI keys.',
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/llm/openai-compatible.ts',
          text: ' * Groq, OpenRouter and Gemini all speak the OpenAI chat-completions API, so one client serves',
        },
      ],
      refs: [
        { component: 'llm-providers' },
        {
          symbol:
            'backend/services/agent/src/llm/openai-compatible.ts#createOpenAiCompatibleProvider',
        },
        { symbol: 'backend/services/agent/src/llm/llm.ts#createLlm' },
        { symbol: 'backend/services/agent/src/llm/mock.ts#createMockProvider' },
        { symbol: 'backend/services/agent/src/structured.ts#completeJson' },
      ],
    },
    {
      id: 'fallback-before-first-token',
      title: 'A model falls back only before its first token',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Each kind of call has a list of models. If one fails before sending any text, with an error worth retrying (a rate limit, a server error, a timeout, a lost connection), the next model is tried. Once text has reached the user, a failure ends the answer instead; a stop or a bad request never moves on.',
            },
            {
              label: 'Why',
              text: 'Switching models mid-answer would join the start of one answer to the rest of another. Before the first token nothing has been shown, so a second model costs the user nothing.',
            },
            {
              label: 'Trade-off',
              text: 'An answer that fails halfway is not rescued: the user keeps the partial text, marked failed, and is not charged. A provider that is slow to start can add up to 20 seconds before the fallback begins.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'llm.test.ts checks the fallback, and that the model never changes once text was sent, after a stop or after a bad request. The provider client gives up when the answer has not started within 20 seconds, or goes silent for 30.',
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/llm/llm.ts',
          text: '!started && !call.signal?.aborted && error instanceof LlmError && error.retryable;',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/llm/llm.ts#createLlm' },
        { symbol: 'backend/services/agent/src/llm/models.ts#MODEL_ROUTES' },
        { symbol: 'backend/services/agent/src/llm/types.ts#LlmError' },
        { flow: 'run-turn' },
      ],
    },
    {
      id: 'one-turn-core',
      title: 'Send, regenerate and edit share one turn core',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Each answer route builds a TurnPlan (how to choose the agent, which memory to load, the reserve key, which messages to save and which to supersede, and whether the history changed) and hands it to runTurn, which does everything else: the lock, the credit check, routing, the per-agent limit, the hold, saving, streaming and settling.',
            },
            {
              label: 'Why',
              text: 'The rules that protect credits and history live in one place, so regenerate and edit cannot drift from a new message: a fix to one is a fix to all three.',
            },
            {
              label: 'Trade-off',
              text: 'A plan has several optional parts, and each route must fill them in correctly; the turn tests cover all three routes.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/turns.ts',
          text: 'How one turn is set up; send, regenerate and edit differ only in these.',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/turns.ts#runTurn' },
        { symbol: 'backend/services/agent/src/turns.ts#turnRouter' },
        { flow: 'run-turn' },
        { flow: 'regenerate-answer' },
        { flow: 'edit-message' },
      ],
    },
    {
      id: 'latest-turn-only',
      title: 'Regenerate and edit act only on the latest turn',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Only the latest answer can be regenerated and only the user's latest message edited, never while that answer is still being written. Chat's last-turn route says what the latest turn is. The replaced messages are kept but superseded, and the memory for the new answer is read fresh from chat without them.",
            },
            {
              label: 'Why',
              text: 'Changing an older turn would leave the later messages answering a question that no longer exists. Keeping superseded messages means nothing is lost, and the cache is dropped so the next turn sees the new history.',
            },
            {
              label: 'Trade-off',
              text: 'There is no branching history: to change an older question, the user starts a new message.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'turns.test.ts checks that regenerate keeps the agent and hides the old answer, that edit replaces the message and its answer, and that both refuse anything but the latest turn with 409.',
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/turns.ts',
          text: "throw new AppError('conflict', 'Only the latest answer can be regenerated');",
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/turns.ts#turnRouter' },
        { symbol: 'backend/services/agent/src/turns.ts#historyWithout' },
        { symbol: 'backend/services/chat/src/internal-routes.ts#internalRouter' },
        { flow: 'regenerate-answer' },
        { flow: 'edit-message' },
      ],
    },
    {
      id: 'stop-over-redis',
      title: 'A stop reaches the answer through Redis',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'A running answer registers its owner in Redis under its turn ID. POST /turns/:turnId/stop checks the owner, then publishes the turn ID on the turn-stops channel; every agent instance listens, and the one running that answer aborts it. The browser also stops reading at once, and a closed stream stops the answer on its own.',
            },
            {
              label: 'Why',
              text: "The stop request can land on any agent instance, not the one writing the answer, and no sticky sessions are needed. The owner check means nobody can stop another user's answer.",
            },
            {
              label: 'Trade-off',
              text: 'Each instance keeps a second Redis connection for listening. A published stop that arrives after the answer ended does nothing, and the route still answers 202 once the owner check passed.',
            },
          ],
        },
        {
          kind: 'text',
          text: 'A stop after text started is charged for what was sent; before any text it is released. stops.test.ts stops an answer running on another instance, for its owner only, and the turn test stops a real streaming answer.',
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/stops.ts',
          text: "const CHANNEL = 'turn-stops';",
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/stops.ts#createStopSignals' },
        { symbol: 'frontend/src/lib/turns.ts#stopTurn' },
        { flow: 'stop-turn' },
      ],
    },
    {
      id: 'per-agent-limits',
      title: 'Each agent has its own per-minute limit, checked before charging',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "After routing and before the credit hold, the turn counts the request against the routed agent's limit for the user (AGENT_RATE_LIMITS: 20 a minute for chat, 5 for every other agent). Over it, the answer is refused with 429 and Retry-After.",
            },
            {
              label: 'Why',
              text: 'The costly agents are held tighter than chat, and a refusal before the hold costs the user nothing.',
            },
            {
              label: 'Trade-off',
              text: 'The limit comes after routing, so a refused message has already used one free router call.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/turns.ts',
          text: '// Each agent has its own per-minute limit: the costly ones are held tighter than chat.',
        },
      ],
      refs: [
        { symbol: 'backend/shared/src/constants.ts#AGENT_RATE_LIMITS' },
        { symbol: 'backend/shared/src/rateLimit.ts#hitRateLimit' },
        { symbol: 'backend/services/agent/src/turns.ts#runTurn' },
        { flow: 'run-turn' },
      ],
    },
    {
      id: 'telemetry-per-attempt',
      title: 'Every model attempt is recorded, and recording never slows an answer',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The model layer reports every attempt, a failed one before a fallback included, with its purpose, agent, answer, provider, model, tokens, time to the first token, latency and outcome (ok, error or stopped). The agent saves each one in its llmCalls collection with the request's user and ID, without waiting for the write.",
            },
            {
              label: 'Why',
              text: 'What an answer really cost, and which models are slow or failing, can only be seen if every attempt is kept.',
            },
            {
              label: 'Trade-off',
              text: 'A record can be lost if its write fails; the failure is only logged, because an answer must never wait for or fail on telemetry.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/telemetry.ts',
          text: ' * the first token came, and how it ended. Saving is fire-and-forget: telemetry must never slow',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/llm/llm.ts#createLlm' },
        { symbol: 'backend/services/agent/src/telemetry.ts#llmCallRecorder' },
        { symbol: 'backend/services/agent/src/telemetry.ts#LlmCallModel' },
      ],
    },
    {
      id: 'code-as-markdown',
      title: 'Code files stream as Markdown and are parsed afterwards',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The code agent asks the model to write each file as a heading with its path and a fenced block. The text streams like any answer; when it ends, the files are parsed, their paths and sizes checked, and they are sent as an artifact and saved with the answer.',
            },
            {
              label: 'Why',
              text: 'The user watches the code being written instead of waiting for a finished JSON payload, and any model that writes Markdown can do it.',
            },
            {
              label: 'Trade-off',
              text: 'A file the model formats wrongly is simply not in the artifact (it stays readable in the text), and a stopped answer gets no files.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/agents/code-files.ts',
          text: ' * The files a code answer contains. The model writes them as Markdown, so the user sees the code',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/agents/code-files.ts#parseCodeFiles' },
        { symbol: 'backend/services/agent/src/agents/code.ts#codeAgent' },
        { flow: 'code-answer' },
      ],
    },
    {
      id: 'files-viewer',
      title: 'A read-only file viewer and a sealed preview, not an editor',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The files panel shows each file as read-only, highlighted code (highlight.js with common languages only), with copy, download and a zip. A web page previews in an iframe sandboxed with allow-scripts only, its CSS and JavaScript put inline and a Content-Security-Policy of default-src 'none'. No code editor such as Monaco is loaded.",
            },
            {
              label: 'Why',
              text: 'Reading, copying and trying the code is what users need, and an editor would add megabytes to the page. Generated code can run in the preview, but cannot reach the app, its cookies or storage, or the network.',
            },
            {
              label: 'Trade-off',
              text: 'Files cannot be changed in place; a preview that needs a library from the web will not load it.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'frontend/src/components/chat/artifact-panel.tsx',
          text: '// Scripts may run, but with no same-origin access: no cookies, no storage, no page.',
        },
      ],
      refs: [
        { symbol: 'frontend/src/components/chat/artifact-panel.tsx#ArtifactPanel' },
        { symbol: 'frontend/src/lib/code-files.ts#previewDocument' },
        { symbol: 'frontend/src/lib/highlight.ts#highlightCode' },
        { flow: 'code-answer' },
      ],
    },
    {
      id: 'safe-markdown',
      title: 'Answers render as Markdown that cannot run or load anything',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Answers render with react-markdown: raw HTML is shown as text and javascript: links are dropped. An image the model writes becomes a plain link, never loaded (SEC-10), and every link opens in a new tab with noopener, noreferrer and nofollow.',
            },
            {
              label: 'Why',
              text: "Answers are model output, which can be steered by what users or web pages write. An image would let an answer call any server with the reader's details, like a tracking pixel.",
            },
            {
              label: 'Trade-off',
              text: 'Answers cannot show images inline; the reader clicks the link to see one.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'frontend/src/components/chat/markdown.tsx',
          text: '// A model-written image is shown as a link to it, never loaded (SEC-10).',
        },
      ],
      refs: [
        { symbol: 'frontend/src/components/chat/markdown.tsx#Markdown' },
        { file: 'frontend/src/components/chat/markdown.test.tsx' },
      ],
    },
    {
      id: 'abort-on-unmount',
      title: 'Leaving a chat stops reading, safely under React development mode',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "When the chat thread unmounts, it aborts the running answer's stream, but only after a tick, and only if it has not mounted again. The server then settles the answer as a stop.",
            },
            {
              label: 'Why',
              text: "React's development mode mounts, unmounts and mounts again on purpose. Aborting straight away would stop every first answer in development; waiting a tick tells a real departure from that rehearsal.",
            },
            {
              label: 'Trade-off',
              text: 'Leaving a chat mid-answer counts as a stop: text already sent is charged.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'frontend/src/hooks/use-chat-thread.ts',
          text: '// development mode unmounts and remounts once on purpose, so the abort waits a tick and only',
        },
      ],
      refs: [
        { symbol: 'frontend/src/hooks/use-chat-thread.ts#useChatThread' },
        { flow: 'stop-turn' },
      ],
    },
    {
      id: 'server-pricing',
      title: 'Orders are priced on the server',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The browser only names a plan. Billing takes the price and the credits from the shared plan config, creates the Razorpay order for that amount and saves both on a payment record before the checkout opens. The order body is strict, so an extra amount field is refused.',
            },
            {
              label: 'Why',
              text: 'Anything the browser sends can be changed by the user. With the amount fixed on the server and on the order, a tampered request cannot buy credits for less.',
            },
            {
              label: 'Trade-off',
              text: 'Every purchase needs a round trip to billing and to Razorpay before the payment window opens.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/billing/src/payment-routes.ts',
          text: '// The price comes from the plan config; the browser only says which plan.',
        },
      ],
      refs: [
        { symbol: 'backend/services/billing/src/payment-routes.ts#paymentRouter' },
        { symbol: 'backend/shared/src/constants.ts#PLANS' },
        { flow: 'buy-credits' },
      ],
    },
    {
      id: 'one-grant',
      title: "One idempotent grant for the browser's check and the webhook",
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Both reports of a payment, the browser's signed checkout result and Razorpay's webhook, call the same grantPurchase. It flips the payment from created to paid in a transaction and adds the credits only if that flip happened; a unique index allows one purchase entry per payment.",
            },
            {
              label: 'Why',
              text: 'The browser can close before it reports, and Razorpay can deliver an event more than once. One grant that is safe to repeat covers both, in any order and even at the same moment (SEC-05).',
            },
            {
              label: 'Trade-off',
              text: "The credits arrive with whichever report is first, so a user whose browser closed waits for Razorpay's webhook.",
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/billing/src/credits.ts',
          text: "Grants a paid order's credits, once, whoever reports the payment first: the browser's verify",
        },
      ],
      refs: [
        { symbol: 'backend/services/billing/src/credits.ts#grantPurchase' },
        { file: 'backend/services/billing/src/payments.test.ts' },
        { flow: 'buy-credits' },
        { flow: 'payment-webhook' },
      ],
    },
    {
      id: 'webhooks-in-gateway',
      title: 'Webhooks go through the gateway, as marked routes',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Razorpay's webhook reaches billing through the same public path as everything else: the Next.js server, then a gateway route marked webhook. That mark skips the Origin check and passes the route's two signature headers on; billing checks the signature over the raw body, which the gateway forwards unchanged.",
            },
            {
              label: 'Why',
              text: 'Billing stays private behind the gateway, and the one exception is written on one route in the table, where it is easy to review. The signature takes the place of the Origin check, which a server-to-server call cannot pass.',
            },
            {
              label: 'Trade-off',
              text: "The Next.js server has to pass Razorpay's headers on for every request, though only the webhook route uses them.",
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/gateway/src/guards.ts',
          text: '// A webhook comes from another server, not a browser; its service checks its signature.',
        },
      ],
      refs: [
        { symbol: 'backend/gateway/src/route-table.ts#PublicRoute' },
        { symbol: 'backend/gateway/src/guards.ts#originCheck' },
        { symbol: 'backend/shared/src/service.ts#rawBodyOf' },
        { flow: 'payment-webhook' },
      ],
    },
    {
      id: 'usage-time-zone',
      title: "Usage days are counted in the viewer's time zone",
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The usage page sends the browser's time zone, billing groups the usage entries by calendar day in that zone, and the page fills in the quiet days ending on the viewer's today. Billing accepts any zone the runtime knows, aliases included.",
            },
            {
              label: 'Why',
              text: "Grouped by UTC days, late-evening answers in India would land on the next day, and the last column would not be the viewer's today.",
            },
            {
              label: 'Trade-off',
              text: 'The same usage can show on different days for two people in different zones.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'frontend/src/components/billing/usage-view.tsx',
          text: "// Days are counted on the viewer's own clock.",
        },
      ],
      refs: [
        { symbol: 'backend/services/billing/src/usage-routes.ts#usageRouter' },
        { symbol: 'frontend/src/components/billing/daily-chart.tsx#fillDays' },
        { flow: 'usage-summary' },
      ],
    },
    {
      id: 'chart-token',
      title: 'A colour token of its own for charts',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Chart columns and agent bars use --chart-bar: the accent in light mode, and a step darker than the accent in dark mode. Its values were checked for contrast in both themes. The chart has one series, so it has no legend, and a hidden table repeats its numbers.',
            },
            {
              label: 'Why',
              text: 'The dark-mode accent is tuned for buttons and links; as a large filled area it is too bright next to other data colours. A token of its own lets charts change without touching the accent.',
            },
            {
              label: 'Trade-off',
              text: 'One more token to keep in line with the accent when the palette changes.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'frontend/src/styles/tokens.css',
          text: '/* Chart bars: the accent, a step darker in dark mode to stay in the data-colour lightness band. */',
        },
      ],
      refs: [
        { symbol: 'frontend/src/components/billing/daily-chart.tsx#DailyChart' },
        { file: 'frontend/src/styles/tokens.css' },
      ],
    },
    {
      id: 'presigned-post',
      title: 'Uploads go straight to S3 with a presigned POST',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The agent signs a short-lived upload form for one key, fixing the Content-Type and a size range, and the client posts the file straight to S3. The bytes never pass through the Next.js server, the gateway or the agent.',
            },
            {
              label: 'Why',
              text: 'S3 itself refuses a file of the wrong size or type, which a presigned PUT link cannot do for a size range, and large files do not tie up the servers on the way.',
            },
            {
              label: 'Trade-off',
              text: "An upload takes two calls to the agent around the client's own post, and the agent must check afterwards what actually arrived. It has been tested only against an in-memory bucket: a live run needs a bucket the agent's key can use.",
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/files/file-store.ts',
          text: "['content-length-range', 1, maxBytes],",
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/files/file-store.ts#createS3FileStore' },
        { symbol: 'backend/services/agent/src/files/file-routes.ts#fileRouter' },
        { flow: 'upload-file' },
      ],
    },
    {
      id: 'content-sniffing',
      title: 'Uploads are checked by their bytes, not their names',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "When an upload completes, the agent reads what S3 holds: the stored type must be the announced one, the size within the type's limit, the first bytes the type's signature, and a PDF must open with at most 200 pages. A file that fails is deleted.",
            },
            {
              label: 'Why',
              text: "A browser's type is only a label, and a file name says nothing. Checking the bytes means a renamed file cannot pass as a PDF or an image (SEC-07).",
            },
            {
              label: 'Trade-off',
              text: 'Completing a PDF reads the whole file once to count its pages.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/files/file-checks.ts',
          text: 'The type a browser claims is only a first filter: after the upload the',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/files/file-checks.ts#matchesSignature' },
        { symbol: 'backend/services/agent/src/files/file-routes.ts#countPdfPages' },
        { flow: 'upload-file' },
      ],
    },
    {
      id: 'id-only-keys',
      title: 'Storage keys are built from IDs only',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "A file's key is users/<user ID>/uploads/<file ID>, made by the server. The name the user gave is cleaned and kept only for display and downloads.",
            },
            {
              label: 'Why',
              text: "A name such as ../../other-user/file can never choose or change where a file is stored (SEC-07). Every file is reached through its ID and its owner's session.",
            },
            {
              label: 'Trade-off',
              text: 'The bucket cannot be browsed by file name; the database is the only map from names to files.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/files/file-checks.ts',
          text: '/** The storage key: built from IDs only, so a file name can never choose or change it. */',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/files/file-checks.ts#storageKey' },
        { symbol: 'backend/services/agent/src/files/file-checks.ts#displayName' },
      ],
    },
    {
      id: 'rag-over-rest',
      title: 'Embeddings and vectors over REST, without SDKs',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "The agent calls Gemini's embedding API and Qdrant's REST API with fetch, behind two small interfaces (Embedder and VectorStore) with in-memory stand-ins. Every search and delete carries an owner and document filter.",
            },
            {
              label: 'Why',
              text: 'The agent needs a handful of calls, which fetch handles in a few lines, as it already does for the AI providers. The stand-ins let indexing and clean-up run in tests and mock mode with no keys and no Qdrant. A live check with real Gemini embeddings and a local Qdrant ranked the right page first.',
            },
            {
              label: 'Trade-off',
              text: 'Changes in those APIs have to be followed by hand, without an SDK to update.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/rag/embeddings.ts',
          text: "'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents',",
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/rag/embeddings.ts#createGeminiEmbedder' },
        { symbol: 'backend/services/agent/src/rag/vector-store.ts#createQdrantStore' },
        { flow: 'index-pdf' },
        { component: 'qdrant' },
      ],
    },
    {
      id: 'cleanup-by-asking',
      title: 'The agent asks chat which chats are gone',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Deleting a chat stays one update in chat. Every ten minutes the agent asks chat which of its files' chats are gone for each user, and removes their files, documents and indexed pieces.",
            },
            {
              label: 'Why',
              text: "Chat never has to know about files or call the agent, and nothing is missed if the agent was down when a chat was deleted. Chat counts someone else's chat as gone, so a file never outlives its owner's chat.",
            },
            {
              label: 'Trade-off',
              text: "A deleted chat's files stay for up to ten minutes.",
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/rag/cleanup.ts',
          text: "Every few minutes the agent asks chat which of its files' chats are gone,",
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/rag/cleanup.ts#cleanUpDeletedChats' },
        { symbol: 'backend/services/chat/src/internal-routes.ts#internalRouter' },
        { flow: 'chat-file-cleanup' },
      ],
    },
    {
      id: 'checked-outlines',
      title: 'Files are drawn from checked outlines, never from model markup',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'To make a PDF, a deck or an image, the model writes JSON in a fixed shape (an outline, or an image prompt), checked by a schema with limits on every list and string. The agent lays the file out itself with pdfkit or pptxgenjs.',
            },
            {
              label: 'Why',
              text: 'Markup or HTML from the model could carry links, scripts or tricks into a file people download. Plain text in a known shape cannot, and the limits stop a runaway reply from making a huge file.',
            },
            {
              label: 'Trade-off',
              text: 'Files follow one plain layout; the model cannot choose fonts, colours or pictures inside a document.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/generate/outlines.ts',
          text: 'What the model writes before a file is drawn: a checked outline, never free-form markup, so a',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/generate/outlines.ts#documentOutline' },
        { symbol: 'backend/services/agent/src/generate/render.ts#renderPdf' },
        { flow: 'generate-file' },
      ],
    },
    {
      id: 'file-ids-not-links',
      title: 'Generated files keep their IDs, never their links',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'A file an agent makes is announced once in the stream with a fresh 5-minute link, but the answer saves only its ID (fileRefs). Whenever the file is shown or downloaded later, the browser asks for a new link.',
            },
            {
              label: 'Why',
              text: 'Signed links expire. A chat opened next week must still show its images and download its files; IDs never go stale, and links never sit in the database.',
            },
            {
              label: 'Trade-off',
              text: 'Each image or download costs one more request for its link.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/files/generated.ts',
          text: '/** A generated file as the stream announces it: a fresh link, never stored. */',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/files/generated.ts#saveGenerated' },
        { symbol: 'frontend/src/components/chat/generated-files.tsx#GeneratedFiles' },
        { flow: 'generate-file' },
      ],
    },
    {
      id: 'vision-fallback',
      title: 'Three vision models in turn, each with low reasoning',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'Image questions go to gemini-3.5-flash, then gemini-3.8-flash, then gemini-flash-latest, each asked for low reasoning. The next one is tried only if one fails before its first token, as for every route.',
            },
            {
              label: 'Why',
              text: 'Google retired gemini-2.5-flash for new keys, and a single model can be retired or busy. Low reasoning keeps answers about a picture quick.',
            },
            {
              label: 'Trade-off',
              text: 'Answers can come from different Gemini models from one day to the next.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/llm/models.ts',
          text: '/** Questions about an image. (Google retired gemini-2.5-flash for new keys.) */',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/llm/models.ts#MODEL_ROUTES' },
        { symbol: 'backend/services/agent/src/agents/image-qa.ts#createImageQaAgent' },
        { flow: 'image-question' },
      ],
    },
    {
      id: 'pdf-follow-ups',
      title: 'Follow-up PDF questions go through the router, only when the chat has a ready PDF',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "An attached PDF always picks the PDF question agent. Without one, the router model is offered PDF questions as a choice only when the chat already has a PDF that has been read, and then the agent searches all of the chat's ready PDFs.",
            },
            {
              label: 'Why',
              text: 'People ask several questions about one document; they should not have to attach it each time. A chat with no documents is never sent to an agent that has nothing to read.',
            },
            {
              label: 'Trade-off',
              text: 'In a chat with a PDF, a question that is not about it may still be sent to the PDF agent if the router thinks so; that agent then says the document does not cover it.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/routing.ts',
          text: 'offered too once the chat has a readable PDF, so follow-ups need no re-upload.',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/routing.ts#routerPrompt' },
        { symbol: 'backend/services/agent/src/files/documents.ts#readyDocuments' },
        { flow: 'pdf-question' },
      ],
    },
    {
      id: 'attachments-before-charge',
      title: 'Attachments are checked before anything is charged',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "Every attached file must be the user's, from this chat and ready, and a PDF must have been read, before the message is routed, the credits are held or anything is saved. Otherwise the request gets a 404 or 409.",
            },
            {
              label: 'Why',
              text: "An agent never sees another user's file, and a message that cannot be answered costs nothing.",
            },
            {
              label: 'Trade-off',
              text: 'A question sent while its PDF is still being read is refused, not queued; the composer avoids it by waiting for the PDF.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/services/agent/src/turns.ts',
          text: 'a PDF must have finished being read. Anything else refuses the message before it is charged.',
        },
      ],
      refs: [
        { symbol: 'backend/services/agent/src/turns.ts#resolveAttachments' },
        { flow: 'pdf-question' },
        { flow: 'image-question' },
      ],
    },
    {
      id: 'e2e-behaviour',
      title: 'End-to-end tests check behaviour, not wording',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'The Playwright tests look for what a person sees and can do: a new answer, a title instead of New chat, sources, a charge on the usage page, the sign-in page after signing out. They never check the text of an answer.',
            },
            {
              label: 'Why',
              text: 'CI runs in mock mode with canned answers, and the same tests also pass against live providers on a laptop, where the words change every time. Locally all 9 passed.',
            },
            {
              label: 'Trade-off',
              text: 'A wrong but well-formed answer would still pass; answer quality is not what these tests are for.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'e2e/playwright.config.ts',
          text: 'In CI the app runs in mock mode, so answers are canned; the tests check behaviour, not wording,',
        },
      ],
      refs: [
        { file: 'e2e/tests/app.spec.ts' },
        { file: 'e2e/tests/helpers.ts' },
        { flow: 'e2e-run' },
      ],
    },
    {
      id: 'axe-gate',
      title: 'Accessibility checks fail CI on serious or critical problems',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'axe runs on the sign-in, new chat, chat, billing and usage pages, on a desktop and a phone screen, with the WCAG 2.0 A and AA and 2.1 AA rules. A serious or critical problem fails the test; minor ones do not.',
            },
            {
              label: 'Why',
              text: 'Accessibility problems are treated like other bugs, and the first runs found two: a scroll anchor inside the message list, and a <main> that keyboard users could not scroll.',
            },
            {
              label: 'Trade-off',
              text: 'Minor problems and anything axe cannot detect still need a person to check.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'e2e/tests/a11y.spec.ts',
          text: ".filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')",
        },
      ],
      refs: [
        { file: 'e2e/tests/a11y.spec.ts' },
        { symbol: 'frontend/src/app/(app)/layout.tsx#AppLayout' },
        { flow: 'e2e-run' },
      ],
    },
    {
      id: 'forward-visitor-ip',
      title: "Server renders pass on the visitor's address",
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: "When a server component calls the gateway directly, it sends the visitor's x-forwarded-for, as the /api proxy already did.",
            },
            {
              label: 'Why',
              text: "Without it, every server render counted against the Next.js server's own address, so all visitors together shared one per-IP limit. The end-to-end run hit that limit and found it.",
            },
            {
              label: 'Trade-off',
              text: 'The gateway must trust exactly one proxy hop (TRUST_PROXY_HOPS) for the address to be the real one.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'frontend/src/server/gateway-fetch.ts',
          text: "// The visitor's own address, as the /api proxy forwards it: without it every server render",
        },
      ],
      refs: [
        { symbol: 'frontend/src/server/gateway-fetch.ts#gatewayGet' },
        { symbol: 'backend/gateway/src/guards.ts#ipRateLimit' },
        { flow: 'e2e-run' },
      ],
    },
    {
      id: 'configurable-limits',
      title: 'Gateway rate limits can be set, with strict defaults',
      status: 'verified',
      blocks: [
        {
          kind: 'fields',
          fields: [
            {
              label: 'Decision',
              text: 'RATE_LIMIT_PER_IP and RATE_LIMIT_PER_USER set the per-IP and per-user limits, by default 120 and 60 requests a minute. The e2e job raises the per-IP limit; the example settings leave both commented out.',
            },
            {
              label: 'Why',
              text: 'A test run, or many people behind one address, can need more from one IP; everyone else keeps the strict limits.',
            },
            {
              label: 'Trade-off',
              text: 'A raised limit in the wrong place would weaken the protection, so the settings say to raise them only for those cases.',
            },
          ],
        },
        {
          kind: 'quote',
          file: 'backend/gateway/src/env-schema.ts',
          text: 'Requests a minute from one IP address and from one signed-in user. Raise them only where',
        },
      ],
      refs: [
        { symbol: 'backend/gateway/src/env-schema.ts#gatewayEnvSchema' },
        { symbol: 'backend/gateway/src/guards.ts#userRateLimit' },
      ],
    },
  ],
};

import type { DocPage } from '../schema.ts';

export const deploymentPage: DocPage = {
  id: 'deployment',
  title: 'Deployment',
  summary:
    'How GilderAi runs: local data stores in Docker, the apps started with pnpm, checks in CI, and the Docker images, Compose stack, deploy workflow and backups for a server.',
  sections: [
    {
      id: 'local-infrastructure',
      title: 'Local data stores in Docker Compose',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: '`backend/docker-compose.yml` runs the data stores the apps need on a developer machine. `pnpm infra:up` starts them and waits until each one is healthy; `pnpm infra:ps`, `infra:logs` and `infra:down` show, follow and stop them. Data is kept in named volumes, so it survives restarts and `infra:down`.',
        },
        {
          kind: 'list',
          items: [
            'MongoDB 8, as a single-node replica set named `rs0`. Its health check creates the replica set on the first run.',
            'Redis 7, saving to disk (append-only file), with the `noeviction` policy.',
            'Qdrant 1.16, a vector database. The agent stores the pieces of uploaded PDFs in it when QDRANT_URL is set, as its .env.example does.',
          ],
        },
        {
          kind: 'text',
          text: "There is no storage container: files are stored in AWS S3, even in development. Uploads need a bucket of your own and an IAM user limited to it (the agent's four S3 settings); without them, uploads answer 503. So far uploads have been tested only against an in-memory bucket: a live run needs a bucket the agent's key can use.",
        },
        {
          kind: 'quote',
          file: 'backend/docker-compose.yml',
          text: '# Files are stored in AWS S3, even in development, so there is no storage container here.',
        },
      ],
      refs: [
        { file: 'backend/docker-compose.yml' },
        { component: 'mongodb' },
        { component: 'redis' },
        { component: 'qdrant' },
        { component: 's3' },
      ],
    },
    {
      id: 'ports',
      title: 'Ports',
      status: 'verified',
      blocks: [
        {
          kind: 'table',
          columns: ['What', 'Port', 'Set by'],
          rows: [
            ['Frontend (Next.js)', '3000', '`next dev --port 3000` in its `package.json`'],
            ['Gateway', '8000', '`PORT`, with the default in its `env.ts`'],
            ['Auth service', '8001', '`PORT`, with the default in its `env.ts`'],
            ['Chat service', '8002', '`PORT`, with the default in its `env.ts`'],
            ['Agent service', '8003', '`PORT`, with the default in its `env.ts`'],
            ['Billing service', '8004', '`PORT`, with the default in its `env.ts`'],
            ['MongoDB', '27018', '`MONGO_PORT` in Docker Compose (27017 inside the container)'],
            ['Redis', '6380', '`REDIS_PORT` in Docker Compose (6379 inside the container)'],
            ['Qdrant', '6335', '`QDRANT_PORT` in Docker Compose (6333 inside the container)'],
            ['Docs explorer', '3100', 'Its Vite config'],
          ],
        },
        {
          kind: 'text',
          text: 'The data store ports are not the usual ones, so GilderAi can run next to other local projects.',
        },
        {
          kind: 'quote',
          file: 'backend/docker-compose.yml',
          text: "- '${MONGO_PORT:-27018}:27017'",
          caption:
            'Host port 27018, unless MONGO_PORT says otherwise, maps to 27017 in the container',
        },
      ],
      refs: [
        { component: 'frontend' },
        { component: 'gateway' },
        { component: 'auth' },
        { component: 'chat' },
        { component: 'agent' },
        { component: 'billing' },
        { component: 'mongodb' },
        { component: 'redis' },
        { component: 'qdrant' },
        { symbol: 'backend/shared/src/env.ts#portSchema' },
      ],
    },
    {
      id: 'env-files',
      title: 'Settings and env files',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'Each app reads its settings from environment variables. `pnpm setup:env` creates the files they come from: for each backend app it copies `.env.example` to `.env`, and for the frontend it copies `.env.example` to `.env.local`. It never overwrites a file that already exists. Only the examples are committed; the real env files are ignored by git. The examples also list, empty, the keys for outside services: the Firebase web config and service account, the AI providers, S3 and Razorpay.',
        },
        {
          kind: 'text',
          text: "`pnpm setup:keys` then writes the key pairs for internal tokens into those files: the gateway's private key as `INTERNAL_PRIVATE_KEY` and its public key as `INTERNAL_PUBLIC_KEY` for each service; auth's own key as `SERVICE_PRIVATE_KEY` and its public key as `AUTH_PUBLIC_KEY` for billing; and the agent's own key as `SERVICE_PRIVATE_KEY` and its public key as `AGENT_PUBLIC_KEY` for chat and billing. Key values are never printed. Run again, it keeps existing private keys and only fixes public keys that are missing or do not match; `pnpm setup:keys --rotate` makes new pairs for all of them. It stops if an env file is missing, so `pnpm setup:env` comes first. Each app refuses to start without the keys it needs, and every private key must parse as an Ed25519 key.",
        },
        {
          kind: 'text',
          text: "Each backend app loads its `.env` with Node's `--env-file-if-exists` flag, then checks every variable with `loadEnv` before anything else runs. A missing or invalid value stops the app with a list of every problem.",
        },
        {
          kind: 'text',
          text: "The gateway's own settings: `FRONTEND_ORIGIN` lists the frontend origins that may send requests that change something, one or several separated by commas, each just an origin such as `http://localhost:3000`. `AUTH_SERVICE_URL`, `CHAT_SERVICE_URL`, `AGENT_SERVICE_URL` and `BILLING_SERVICE_URL` say where each service listens; trailing slashes are dropped. `INTERNAL_PRIVATE_KEY` signs the internal tokens. `TRUST_PROXY_HOPS`, a whole number from 0 to 5 and 1 when not set, says how many proxies in front of the gateway to trust for the client's IP address, which the per-IP rate limit counts; its `.env.example` sets 1, for the Next.js server meant to sit in front of it, and more is needed behind a load balancer. `RATE_LIMIT_PER_IP` and `RATE_LIMIT_PER_USER` (whole numbers, by default 120 and 60) set the requests a minute allowed from one address and from one signed-in user; the example leaves them commented out, to be raised only for end-to-end test runs or many people behind one address.",
        },
        {
          kind: 'text',
          text: "Auth's `.env.example` leaves the three Firebase settings empty and `AUTH_DEV_LOGIN` false. With the Firebase settings empty, auth still starts, logs the warning 'Google sign-in is not set up: the FIREBASE_* settings are empty', and answers Google sign-ins with 503. Setting `AUTH_DEV_LOGIN=true` turns on sign-in with just an email, and auth logs a warning about it at startup.",
        },
        {
          kind: 'text',
          text: "Service URLs for calls between services default to localhost: auth's `BILLING_SERVICE_URL`, and the agent's `CHAT_SERVICE_URL` and `BILLING_SERVICE_URL`. The agent's `LLM_MODE` is `mock` by default, so it answers with canned text and needs no AI keys; `live` calls the real providers and needs `GROQ_API_KEY`. `OPENROUTER_API_KEY` (code answers), `GEMINI_API_KEY` (PDF embeddings) and `TAVILY_API_KEY` (web search) are optional, and empty counts as unset; without a Tavily key, live mode has no search agent, while mock mode always searches with canned results.",
        },
        {
          kind: 'text',
          text: "The agent's `AWS_REGION` (ap-south-1 in the example), `S3_BUCKET`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` turn uploads on, all four or none; otherwise it logs 'uploads are off: ...'. `QDRANT_URL` (http://localhost:6335 in the example) points PDF indexing at the local Qdrant; without it the agent keeps vectors in memory. Billing's `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are Razorpay test-mode keys and turn payments on, all three or none; locally the webhook secret can be any long random string. Without them billing logs 'payments are off: ...' and the payment routes answer 503. The frontend's example also lists `NEXT_PUBLIC_RAZORPAY_KEY_ID`, but no code reads it: the checkout gets the key ID from billing's order answer. The frontend's `S3_BUCKET_ORIGIN` (`https://<S3_BUCKET>.s3.<AWS_REGION>.amazonaws.com`) is read when the app is built: the security policy lets the browser send uploads only to that bucket, so without it uploads can't work.",
        },
        {
          kind: 'quote',
          file: '.gitignore',
          text: '# Environment files: only the examples are committed\n.env\n.env.*\n!.env.example',
        },
      ],
      refs: [
        { file: 'package.json' },
        { file: '.gitignore' },
        { file: 'backend/shared/scripts/setup-keys.ts' },
        { symbol: 'backend/gateway/src/env-schema.ts#gatewayEnvSchema' },
        { component: 'auth' },
        { symbol: 'backend/shared/src/env.ts#loadEnv' },
        { flow: 'app-startup' },
      ],
    },
    {
      id: 'running',
      title: 'Running the apps',
      status: 'verified',
      blocks: [
        {
          kind: 'list',
          items: [
            '`pnpm install` installs every app in the workspace.',
            '`pnpm setup:env` creates the env files.',
            '`pnpm setup:keys` writes the internal-token keys into them.',
            '`pnpm infra:up` starts MongoDB, Redis and Qdrant.',
            '`pnpm dev` starts the frontend and the five backend apps together.',
          ],
        },
        {
          kind: 'text',
          text: "`pnpm dev` runs each app's own `dev` script in parallel, leaving out the docs explorer, which `pnpm docs:dev` runs on its own. The frontend runs `next dev`. Each backend app runs `node --env-file-if-exists=.env --watch src/index.ts`, which restarts it when a file changes; its `start` script is the same command without `--watch`. Only the frontend and the docs explorer are built before they run.",
        },
        {
          kind: 'quote',
          file: 'package.json',
          text: '"dev": "pnpm -r --parallel --if-present --filter \'!@gilder/docs-explorer\' dev",',
        },
      ],
      refs: [{ file: 'package.json' }, { flow: 'app-startup' }, { flow: 'graceful-shutdown' }],
    },
    {
      id: 'health-and-shutdown',
      title: 'Health checks and shutdown',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "Every backend app answers `GET /healthz` (the process is up) and `GET /readyz` (its data stores answer, or 503 if one does not), without an internal token, even on the services, which need one for every other path. The gateway answers them before its rate limits, so probes are never limited. On SIGTERM or SIGINT it stops taking new connections, waits up to 10 seconds for requests in progress, closes its database connections and exits; if the cleanup hangs, it exits with code 1 after 15 seconds. Under `pnpm dev` one Ctrl+C reaches each backend app twice: from the terminal, and again from `node --watch`, which passes it on. The app logs the second as 'already shutting down' and finishes its cleanup. Only the end-to-end CI job calls /healthz, to wait until each app is up; the Docker health checks, in development and in the production stack, cover only the data stores.",
        },
        {
          kind: 'text',
          text: "For an uptime monitor there is one public URL, `GET /api/health` on the site. The web server answers it itself (its static route wins over the /api proxy route): it asks the gateway's `/readyz`, which checks Redis, with a 3-second limit, and answers only `{ status: 'ok' }` with 200 or `{ status: 'unavailable' }` with 503, never cached and never with the gateway's details. So a 200 proves the whole path: Caddy, the web server, the gateway and Redis. Checked against the production build behind Caddy: 200, then 503 with the gateway stopped, then 200 again.",
        },
        {
          kind: 'quote',
          file: 'frontend/src/app/api/health/route.ts',
          text: '// GET /api/health for uptime monitors: 200 when the whole path to the backend works, else 503.',
        },
      ],
      refs: [
        { flow: 'health-check' },
        { flow: 'readiness-check' },
        { flow: 'graceful-shutdown' },
        { symbol: 'backend/shared/src/health.ts#healthRouter' },
        { symbol: 'backend/shared/src/service.ts#startService' },
        { symbol: 'frontend/src/server/health.ts#siteHealth' },
        { symbol: 'frontend/src/app/api/health/route.ts#GET' },
      ],
    },
    {
      id: 'ci',
      title: 'CI pipeline',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'GitHub Actions runs two jobs on every push to `main` and on every pull request: quality, described here, and e2e, below. A newer run for the same branch or pull request cancels the one still running, and the jobs can only read the repo. The quality job stops after 15 minutes. It starts a Redis 7 service, then sets up pnpm (the version in `packageManager`) and Node (the version in `.nvmrc`), then runs these steps in order. The first one that fails stops the job.',
        },
        {
          kind: 'quote',
          file: '.github/workflows/ci.yml',
          text: '      - run: pnpm install --frozen-lockfile\n      - run: pnpm format:check\n      - run: pnpm lint\n      - run: pnpm typecheck\n      - run: pnpm test\n      - run: pnpm build',
        },
        {
          kind: 'text',
          text: "Tests that need Redis use a real one: in CI the Redis service on port 6380, and locally the container from `pnpm infra:up` on the same port. They use database 15, away from the development data in database 0, and each test gets its own random key prefix, so tests running at the same time never see each other's keys. The shared library's MongoDB tests need no Docker: they start an in-memory replica set. `pnpm build` also builds the docs explorer, whose build checks these docs against the code, so CI fails when a doc points at code, a quote or a route that no longer exists.",
        },
        {
          kind: 'quote',
          file: '.github/workflows/ci.yml',
          text: '    services:\n      redis:\n        image: redis:7-alpine\n        ports:\n          - 6380:6379',
          caption: 'The Redis service the tests use in CI',
        },
      ],
      refs: [
        { file: '.github/workflows/ci.yml' },
        { file: '.nvmrc' },
        { file: 'package.json' },
        { symbol: 'backend/shared/src/test-redis.ts#createTestRedis' },
      ],
    },
    {
      id: 'e2e',
      title: 'End-to-end tests',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'The e2e package runs Playwright against the whole app, on a desktop and a phone (Pixel 7) screen: behaviour tests (app.spec.ts) and axe accessibility checks (a11y.spec.ts). Each test signs in a fresh user with dev sign-in. In CI the e2e job starts the data stores with `docker compose up -d` and polls their health checks every 2 seconds for up to 2 minutes, printing the container logs if one never becomes healthy. It pins `MONGO_IMAGE=mongo:8.2.6`, the version the unit tests run: newer 8.x images refuse to start on the Linux 6.19+ kernel the runner has (MongoDB SERVER-121912). It then writes fresh settings in mock mode with dev sign-in on and RATE_LIMIT_PER_IP raised, builds and starts the frontend and the five backend apps, waits for each to answer, installs Chromium and runs the tests; a failed run keeps its report, traces and logs as the e2e-report artifact for 7 days. The job stops after 25 minutes.',
        },
        {
          kind: 'text',
          text: 'Locally, with the app running (`pnpm dev`, with `AUTH_DEV_LOGIN=true` for auth), `pnpm --filter @gilder/e2e e2e` runs them in the installed Chrome against http://localhost:3000, or `E2E_BASE_URL`. They check behaviour, not wording, so they pass against live providers too: all 9 passed. The agent in CI has no S3 settings, so the file agents are not part of this run.',
        },
        {
          kind: 'quote',
          file: '.github/workflows/ci.yml',
          text: "          echo 'RATE_LIMIT_PER_IP=10000' >> backend/gateway/.env",
          caption: 'Every test request comes from one machine, so its per-IP limit is raised',
        },
      ],
      refs: [
        { file: '.github/workflows/ci.yml' },
        { file: 'e2e/playwright.config.ts' },
        { file: 'e2e/tests/app.spec.ts' },
        { file: 'e2e/tests/a11y.spec.ts' },
        { flow: 'e2e-run' },
      ],
    },
    {
      id: 'docker-images',
      title: 'Docker images',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "Two images, both built from the repository root. The backend image holds the gateway and all four services: it installs only the backend's production packages and copies the TypeScript sources, which Node 22 runs directly, so nothing is compiled. It starts the gateway by default, and Compose gives each container its own entry file instead. The web image builds the frontend once with Next.js's standalone output (`output: 'standalone'`, traced from the repository root so the workspace's packages are included) and copies in `.next/static` and `public/`. Both run as the `node` user.",
        },
        {
          kind: 'quote',
          file: 'backend/Dockerfile',
          text: 'CMD ["node", "backend/gateway/src/index.ts"]',
          caption: 'One image; each container picks its app by its entry file',
        },
        {
          kind: 'text',
          text: "The `NEXT_PUBLIC_*` values and `S3_BUCKET_ORIGIN` are baked into the web image when it is built, since the browser gets them anyway; `GATEWAY_URL` is read when the server starts and never reaches the browser. `.dockerignore` is an allow-list: only the root manifests and lockfile, `backend/`, `frontend/` and the docs explorer's and e2e package's manifests go in, never `node_modules`, `.next`, coverage or any `.env` file, so secrets stay on the server.",
        },
      ],
      refs: [
        { file: 'backend/Dockerfile' },
        { file: 'frontend/Dockerfile' },
        { file: '.dockerignore' },
        { file: 'frontend/next.config.ts' },
        { component: 'frontend' },
        { component: 'gateway' },
      ],
    },
    {
      id: 'production-stack',
      title: 'The production Compose stack',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: '`deploy/compose.yml` (project name `gilder-prod`) runs the whole app on one server: the gateway, the four services and the web server from the two images, plus MongoDB, Redis and Qdrant, all on one internal network. Caddy is the only service reachable from outside, on ports 80 and 443. MongoDB (pinned to 8.2.6, so a pull never upgrades the database by surprise) runs as a single-node replica set, which its health check sets up on the first start, because the credits ledger uses transactions, with a 0.25 GB cache for a small server; Redis saves to disk with the `noeviction` policy, as in development. The apps wait until MongoDB and Redis are healthy, and the agent also waits for Qdrant.',
        },
        {
          kind: 'text',
          text: "Next to the Compose file, `.env` sets `DOMAIN` and the image `TAG` (latest by default), and `env/<app>.env` holds each app's secrets and settings in the format of its `.env.example`. The addresses between containers are set in the Compose file itself: the service URLs, `mongodb://mongo:27017/...`, `redis://redis:6379`, `http://qdrant:6333`, `GATEWAY_URL=http://gateway:8000` and `FRONTEND_ORIGIN=https://<DOMAIN>`. `TRUST_PROXY_HOPS` stays 1: Caddy sets the visitor's address and the web server passes it on.",
        },
        {
          kind: 'text',
          text: "Caddy gets and renews its HTTPS certificates itself and sends every request to the web server, which forwards `/api/*` to the gateway. It flushes each streamed piece at once and compresses only HTML, CSS, plain text, JavaScript, JSON and SVG, never the answer stream, where compression would hold tokens back. It also drops the Server header. Checked locally: all 9 end-to-end tests passed through Caddy, the standalone web server and the gateway, tokens streamed through unbuffered, arriving between 77 and 513 ms, and the gateway saw the client's address.",
        },
        {
          kind: 'quote',
          file: 'deploy/Caddyfile',
          text: '\t\t# Send each streamed token on as soon as it arrives.\n\t\tflush_interval -1',
        },
      ],
      refs: [
        { file: 'deploy/compose.yml' },
        { file: 'deploy/Caddyfile' },
        { component: 'mongodb' },
        { component: 'redis' },
        { component: 'qdrant' },
        { flow: 'run-turn' },
      ],
    },
    {
      id: 'deploy-workflow',
      title: 'The deploy workflow',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "`.github/workflows/deploy.yml` runs only by hand, from the Actions tab, once a server is set up; two runs never overlap, and a running one is never cancelled. The first job builds both images with a build cache and pushes them to GitHub's container registry, each tagged with the commit SHA and `latest`; the web image is built with the `NEXT_PUBLIC_*` values and `S3_BUCKET_ORIGIN` from the repository's variables. The second job, in the production environment, sets up SSH with the deploy key from a secret and checks the server's host key against `DEPLOY_KNOWN_HOSTS`, copies `compose.yml`, the `Caddyfile` and `backup.sh` to `~/gilder-ai`, signs the server in to the registry with the job's own `GITHUB_TOKEN` for that pull only, runs `docker compose pull` and `up -d` with the new SHA as the tag, signs out and removes unused images.",
        },
        {
          kind: 'quote',
          file: '.github/workflows/deploy.yml',
          text: 'on:\n  workflow_dispatch:',
          caption: 'Deploys start only by hand',
        },
        {
          kind: 'text',
          text: "`deploy/README.md` gives the setup in order: a server with a fixed IP and ports 80 and 443 open, the domain's `A` record, the settings files next to `compose.yml` (production values, fresh signing keys), a deploy-only SSH key with the server's host key pinned, the repository's secrets and variables, the first run, then the outside services (Firebase authorized domain, consent screen, S3 CORS origin, Razorpay webhook), the health check and the safety nets. It also lists the everyday server commands; any that create containers need `TAG` set to a deployed commit, because the images are private and the server holds only the versions it was deployed with.",
        },
      ],
      refs: [
        { file: '.github/workflows/deploy.yml' },
        { file: 'deploy/compose.yml' },
        { file: 'deploy/README.md' },
      ],
    },
    {
      id: 'backups',
      title: 'Backups',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: "`deploy/backup.sh`, meant to run nightly from cron, dumps every MongoDB database as one compressed archive, copies it to a backup bucket in S3 (one the app's own key cannot read or delete) with the AWS CLI in a container, and keeps the last seven copies on the server. Qdrant is not backed up: its vectors are rebuilt from the PDFs, which are already in S3. Redis holds only sessions and other short-lived state. The script's header gives the restore command.",
        },
        {
          kind: 'quote',
          file: 'deploy/backup.sh',
          text: 'docker compose exec -T mongo mongodump --archive --gzip --quiet > "backups/$name"',
        },
      ],
      refs: [{ file: 'deploy/backup.sh' }, { component: 'mongodb' }, { component: 's3' }],
    },
  ],
};

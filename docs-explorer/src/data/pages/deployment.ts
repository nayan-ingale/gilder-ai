import type { DocPage } from '../schema.ts';

export const deploymentPage: DocPage = {
  id: 'deployment',
  title: 'Deployment',
  summary:
    'How GilderAi runs today: local data stores in Docker, the apps started with pnpm, and checks in CI. Production hosting is not built yet.',
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
            'Qdrant 1.16, a vector database. It runs and is healthy, but no app connects to it yet.',
          ],
        },
        {
          kind: 'text',
          text: 'There is no storage container: files will be stored in AWS S3, even in development. S3 is not used yet; it comes with PDF and image Q&A.',
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
          text: 'Each app reads its settings from environment variables. `pnpm setup:env` creates the files they come from: for each backend app it copies `.env.example` to `.env`, and for the frontend it copies `.env.example` to `.env.local`. It never overwrites a file that already exists. Only the examples are committed; the real env files are ignored by git. The examples also list, empty, the keys for outside services that later features use: the Firebase web config and service account, the AI providers, S3 and Razorpay.',
        },
        {
          kind: 'text',
          text: "`pnpm setup:keys` then writes the key pair for internal tokens into those files: the gateway's private key as `INTERNAL_PRIVATE_KEY`, and the matching public key as `INTERNAL_PUBLIC_KEY` for each service. Key values are never printed. Run again, it keeps the gateway's key and only fixes a service whose public key is missing or does not match; `pnpm setup:keys --rotate` makes a new pair for all of them. It stops if an env file is missing, so `pnpm setup:env` comes first. Auth refuses to start without its public key; the other apps do not read their key yet.",
        },
        {
          kind: 'text',
          text: "Each backend app loads its `.env` with Node's `--env-file-if-exists` flag, then checks every variable with `loadEnv` before anything else runs. A missing or invalid value stops the app with a list of every problem.",
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
          text: "`pnpm dev` runs each app's own `dev` script in parallel, leaving out the docs explorer, which `pnpm docs:dev` runs on its own. The frontend runs `next dev`. Each backend app runs `node --env-file-if-exists=.env --watch src/index.ts`, which restarts it when a file changes; its `start` script is the same command without `--watch`. Only the frontend and the docs explorer have a build step.",
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
          text: "Every backend app answers `GET /healthz` (the process is up) and `GET /readyz` (its data stores answer, or 503 if one does not). On SIGTERM or SIGINT it stops taking new connections, waits up to 10 seconds for requests in progress, closes its database connections and exits; if the cleanup hangs, it exits with code 1 after 15 seconds. Under `pnpm dev` one Ctrl+C reaches each backend app twice: from the terminal, and again from `node --watch`, which passes it on. The app logs the second as 'already shutting down' and finishes its cleanup. Nothing calls the health endpoints automatically yet: the Docker health checks cover only the data stores.",
        },
      ],
      refs: [
        { flow: 'health-check' },
        { flow: 'readiness-check' },
        { flow: 'graceful-shutdown' },
        { symbol: 'backend/shared/src/health.ts#healthRouter' },
        { symbol: 'backend/shared/src/service.ts#startService' },
      ],
    },
    {
      id: 'ci',
      title: 'CI pipeline',
      status: 'verified',
      blocks: [
        {
          kind: 'text',
          text: 'GitHub Actions runs one job on every push to `main` and on every pull request. A newer run for the same branch or pull request cancels the one still running, the job can only read the repo, and it stops after 15 minutes. It starts a Redis 7 service, then sets up pnpm (the version in `packageManager`) and Node (the version in `.nvmrc`), then runs these steps in order. The first one that fails stops the job.',
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
      id: 'production',
      title: 'Production hosting',
      status: 'planned',
      plannedIn: 'Launch',
      blocks: [
        {
          kind: 'text',
          text: 'Not built yet. How GilderAi runs in production will be documented here once it exists.',
        },
      ],
    },
  ],
};

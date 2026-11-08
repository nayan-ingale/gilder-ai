# One image for the gateway and the four services. Node 22 runs the TypeScript sources
# directly, so there is no build step; each app is started with its own entry file, for example
#   docker run gilder-backend node backend/services/auth/src/index.ts
# Build from the repository root: docker build -f backend/Dockerfile .

FROM node:22.22-alpine AS deps
WORKDIR /app
RUN corepack enable
# Every workspace manifest, so the lockfile matches; only the backend's packages are installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/shared/package.json backend/shared/
COPY backend/gateway/package.json backend/gateway/
COPY backend/services/auth/package.json backend/services/auth/
COPY backend/services/chat/package.json backend/services/chat/
COPY backend/services/agent/package.json backend/services/agent/
COPY backend/services/billing/package.json backend/services/billing/
COPY frontend/package.json frontend/
COPY docs-explorer/package.json docs-explorer/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --prod --filter "./backend/**"

FROM node:22.22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app /app
COPY backend backend
USER node
CMD ["node", "backend/gateway/src/index.ts"]

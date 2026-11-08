# The web app, built once and served by Next.js's standalone server.
# Build from the repository root: docker build -f frontend/Dockerfile .
# NEXT_PUBLIC_* values are baked in at build time (they are public: the browser gets them);
# GATEWAY_URL is read when the server starts and never reaches the browser.

FROM node:22.22-alpine AS build
WORKDIR /app
RUN corepack enable
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
RUN pnpm install --frozen-lockfile --filter @gilder/frontend
COPY frontend frontend
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID=""
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @gilder/frontend build

FROM node:22.22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]

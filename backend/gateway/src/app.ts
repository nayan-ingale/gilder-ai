import {
  createService,
  type InternalKey,
  type Logger,
  type ReadinessCheck,
  type Redis,
} from '@gilder/shared';
import express, { type Express, Router } from 'express';
import {
  ipRateLimit,
  originCheck,
  requireSession,
  sessionLookup,
  userRateLimit,
} from './guards.ts';
import { proxyToService } from './proxy.ts';
import { type MatchedRoute, matchRoute, type ServiceName } from './route-table.ts';

export interface AppDeps {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  redis: Redis;
  /** Signs the internal token on every forwarded request. */
  privateKey: InternalKey;
  serviceUrls: Readonly<Record<ServiceName, string>>;
  /** The frontend origins that may send requests that change something. */
  allowedOrigins: readonly string[];
  /** Proxies in front of the gateway to trust for the client's IP address. */
  trustProxyHops: number;
  /** Requests a minute per IP address and per signed-in user; the shared defaults if left out. */
  rateLimits?: { perIp: number; perUser: number };
  /** How long to wait for a service to start answering. */
  headersTimeoutMs?: number;
}

// Request bodies are passed on as raw bytes, never parsed here. Services parse JSON themselves,
// up to their own 64kb limit; files go straight to storage, not through the gateway.
const MAX_BODY = '1mb';

/**
 * The gateway: the only public entry to the backend. Every /api request goes through the checks
 * below, in this order, and is then forwarded to its service. A path that isn't in the route
 * table gets a 404 here and never reaches a service.
 */
export function createApp(deps: AppDeps): Express {
  const { logger, readinessChecks, redis } = deps;

  const api = Router();
  api.use(ipRateLimit(redis, deps.rateLimits?.perIp));
  api.use((req, res, next) => {
    const matched = matchRoute(req.method, req.path);
    if (!matched) {
      next('router');
      return;
    }
    res.locals.route = matched;
    next();
  });
  api.use(originCheck(deps.allowedOrigins));
  api.use(sessionLookup(redis));
  api.use(userRateLimit(redis, deps.rateLimits?.perUser));
  api.use((req, res, next) => {
    const { route } = res.locals.route as MatchedRoute;
    if (route.session === 'required') {
      requireSession()(req, res, next);
      return;
    }
    next();
  });
  api.use(express.raw({ type: () => true, limit: MAX_BODY }));
  api.use(
    proxyToService({
      serviceUrls: deps.serviceUrls,
      privateKey: deps.privateKey,
      ...(deps.headersTimeoutMs ? { headersTimeoutMs: deps.headersTimeoutMs } : {}),
    }),
  );

  return createService({
    name: 'gateway',
    logger,
    readinessChecks,
    parseJson: false,
    routes: (app) => {
      // req.ip is the client's address, read from X-Forwarded-For across this many proxies.
      app.set('trust proxy', deps.trustProxyHops);
      app.use(api);
    },
  });
}

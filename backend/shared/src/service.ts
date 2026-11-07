import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './errors.ts';
import { healthRouter, isHealthProbe, type ReadinessCheck } from './health.ts';
import { type InternalKey, requireInternalToken } from './internalToken.ts';
import type { Logger } from './logger.ts';
import { REQUEST_ID_HEADER, requestId } from './requestId.ts';

export interface ServiceOptions {
  name: string;
  logger: Logger;
  /** Adds the app's own routes. Runs after the shared middleware, before 404 and error handling. */
  routes?: (app: Express) => void;
  readinessChecks?: Record<string, ReadinessCheck>;
  /** Largest JSON body accepted. Defaults to 64kb. */
  bodyLimit?: string;
  /**
   * Parse JSON bodies into req.body. Defaults to true. The gateway turns it off: it passes bodies
   * on to the services untouched, and they parse them.
   */
  parseJson?: boolean;
  /**
   * For services behind the gateway: every route except /healthz and /readyz then needs a valid
   * internal token addressed to `audience`, so a direct call gets 401 whatever the path.
   */
  internalAuth?: { publicKey: InternalKey; audience: string };
}

/**
 * Builds an Express app with the shared middleware in the right order: request ID → request
 * logging → security headers → JSON body → health → internal token → routes → 404 → errors.
 */
export function createService({
  name,
  logger,
  routes,
  readinessChecks = {},
  bodyLimit = '64kb',
  parseJson = true,
  internalAuth,
}: ServiceOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId());
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => String(res.getHeader(REQUEST_ID_HEADER) ?? ''),
      autoLogging: { ignore: isHealthProbe },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) {
          return 'error';
        }
        return res.statusCode >= 400 ? 'warn' : 'info';
      },
    }),
  );
  app.use(helmet());
  if (parseJson) {
    app.use(express.json({ limit: bodyLimit }));
  }
  app.use(healthRouter(name, readinessChecks, logger));
  // After health, so probes need no token; before the routes, so an unknown path without a token
  // gets 401 rather than a 404 that would confirm which paths exist.
  if (internalAuth) {
    app.use(requireInternalToken(internalAuth.publicKey, internalAuth.audience));
  }

  routes?.(app);

  app.use(notFoundHandler());
  app.use(errorHandler(logger));
  return app;
}

export interface StartOptions {
  port: number;
  logger: Logger;
  /** Closes databases and other resources after the server stops accepting requests. */
  onShutdown?: () => Promise<void>;
  /** Longest time to wait for in-flight requests before closing their connections. */
  shutdownTimeoutMs?: number;
  /** Shut down cleanly on SIGTERM / SIGINT. Defaults to true; tests turn it off. */
  handleSignals?: boolean;
}

export interface RunningService {
  port: number;
  close: () => Promise<void>;
}

/** How long the cleanup gets after in-flight connections are cut, before the process exits anyway. */
const CLEANUP_GRACE_MS = 5_000;

/** Starts listening and wires graceful shutdown. Resolves once the port is open. */
export function startService(app: Express, options: StartOptions): Promise<RunningService> {
  const { logger, onShutdown, shutdownTimeoutMs = 10_000, handleSignals = true } = options;

  return new Promise((resolve, reject) => {
    const server = app.listen(options.port, (error) => {
      if (error) {
        reject(error);
        return;
      }
      const { port } = server.address() as AddressInfo;
      logger.info({ port }, 'listening');

      let closing: Promise<void> | undefined;
      const close = (): Promise<void> => {
        closing ??= new Promise<void>((done) => {
          // Stop accepting new connections and close the idle ones; let in-flight requests
          // finish, and cut the connections of any still running after the timeout.
          server.close(() => done());
          setTimeout(() => server.closeAllConnections(), shutdownTimeoutMs).unref();
        }).then(async () => {
          await onShutdown?.();
          logger.info('shut down cleanly');
        });
        return closing;
      };

      // A keep-alive connection whose request finishes during the shutdown would otherwise sit
      // idle for keepAliveTimeout (about 6 s) and hold the shutdown up, so it is closed as soon as
      // its response is sent. On the next tick, not inside the 'finish' handler itself: closing it
      // there can cut off the end of the response before the client has received it.
      server.on('request', (_req, res) => {
        res.on('finish', () => {
          if (closing) {
            setImmediate(() => server.closeIdleConnections());
          }
        });
      });

      if (handleSignals) {
        let signalled = false;
        const onSignal = (signal: NodeJS.Signals) => {
          // Only the first signal counts. Under `node --watch` one Ctrl+C arrives twice (from the
          // terminal and from the watcher), and the handler stays registered for both: a signal
          // with no handler left would make Node kill the app before its cleanup is done.
          if (signalled) {
            logger.info({ signal }, 'already shutting down');
            return;
          }
          signalled = true;
          logger.info({ signal }, 'shutting down');
          // A backstop, so a cleanup that hangs can't keep the process alive forever.
          const backstop = setTimeout(() => {
            logger.error('shutdown timed out');
            process.exit(1);
          }, shutdownTimeoutMs + CLEANUP_GRACE_MS);
          backstop.unref();
          close()
            .then(
              () => 0,
              (shutdownError: unknown) => {
                logger.error({ err: shutdownError }, 'shutdown failed');
                return 1;
              },
            )
            .then((code) => {
              clearTimeout(backstop);
              process.exit(code);
            });
        };
        process.on('SIGTERM', onSignal);
        process.on('SIGINT', onSignal);
      }

      resolve({ port, close });
    });
  });
}

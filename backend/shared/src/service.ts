import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './errors.ts';
import { healthRouter, type ReadinessCheck } from './health.ts';
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
}

/**
 * Builds an Express app with the shared middleware in the right order:
 * request ID → request logging → security headers → JSON body → health → routes → 404 → errors.
 */
export function createService({
  name,
  logger,
  routes,
  readinessChecks = {},
  bodyLimit = '64kb',
}: ServiceOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId());
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => String(res.getHeader(REQUEST_ID_HEADER) ?? ''),
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) {
          return 'error';
        }
        return res.statusCode >= 400 ? 'warn' : 'info';
      },
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: bodyLimit }));
  app.use(healthRouter(name, readinessChecks, logger));

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
          // Stop accepting new connections; let in-flight requests finish.
          server.close(() => done());
          server.closeIdleConnections();
          setTimeout(() => server.closeAllConnections(), shutdownTimeoutMs).unref();
        }).then(async () => {
          await onShutdown?.();
          logger.info('shut down cleanly');
        });
        return closing;
      };

      if (handleSignals) {
        for (const signal of ['SIGTERM', 'SIGINT'] as const) {
          process.once(signal, () => {
            logger.info({ signal }, 'shutting down');
            close().then(
              () => process.exit(0),
              (shutdownError: unknown) => {
                logger.error({ err: shutdownError }, 'shutdown failed');
                process.exit(1);
              },
            );
          });
        }
      }

      resolve({ port, close });
    });
  });
}

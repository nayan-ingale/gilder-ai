import {
  pino,
  type DestinationStream,
  type LevelWithSilent,
  type Logger,
  type LoggerOptions,
} from 'pino';
import { getContext } from './context.ts';

export type { Logger };

/** Values that must never reach the logs. Replaced with "[REDACTED]". */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-internal-token"]',
  'res.headers["set-cookie"]',
  'password',
  'token',
  'idToken',
  'apiKey',
  'secret',
  'signature',
  '*.password',
  '*.token',
  '*.idToken',
  '*.apiKey',
  '*.secret',
  '*.signature',
];

export interface CreateLoggerOptions {
  service: string;
  level?: LevelWithSilent;
  /** Human-readable colored output, for local development only. */
  pretty?: boolean;
  /** Where to write logs. Defaults to stdout; tests pass a stream to read the output. */
  destination?: DestinationStream;
}

export function createLogger({
  service,
  level = 'info',
  pretty = false,
  destination,
}: CreateLoggerOptions): Logger {
  const options: LoggerOptions = {
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    formatters: { level: (label) => ({ level: label }) },
    // Every log line written while handling a request carries its request ID (and user, once known).
    mixin() {
      const context = getContext();
      if (!context) {
        return {};
      }
      return context.userId
        ? { requestId: context.requestId, userId: context.userId }
        : { requestId: context.requestId };
    },
  };

  if (destination) {
    return pino(options, destination);
  }
  if (pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
    });
  }
  return pino(options);
}

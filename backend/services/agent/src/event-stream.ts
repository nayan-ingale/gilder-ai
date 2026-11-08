import type { Response } from 'express';

/**
 * A server-sent events reply: named events with JSON data, and a comment every 15 seconds so
 * proxies and browsers keep a quiet connection open while the model thinks.
 */

export interface EventStream {
  send(event: string, data: unknown): void;
  /** False once the client has gone or the stream is closed. */
  readonly open: boolean;
  close(): void;
}

export function openEventStream(res: Response, heartbeatMs = 15_000): EventStream {
  res.status(200);
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  // no-transform stops proxies from compressing or buffering the stream.
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders();

  const writable = () => !res.writableEnded && !res.destroyed;
  const heartbeat = setInterval(() => {
    if (writable()) {
      res.write(': ping\n\n');
    }
  }, heartbeatMs);
  heartbeat.unref();

  return {
    send(event, data) {
      if (writable()) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    },
    get open() {
      return writable();
    },
    close() {
      clearInterval(heartbeat);
      if (writable()) {
        res.end();
      }
    },
  };
}

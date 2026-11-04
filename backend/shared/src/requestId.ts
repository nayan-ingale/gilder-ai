import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { runWithContext } from './context.ts';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept an incoming ID only if it looks like one: this stops log injection through the header.
const SAFE_REQUEST_ID = /^[\w.-]{8,128}$/;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express extends its types this way
  namespace Express {
    interface Locals {
      requestId: string;
      /** Set by requireInternalToken() once the caller is known. */
      userId?: string;
    }
  }
}

/**
 * Reuses the caller's X-Request-Id (so one ID follows a request through the frontend, the gateway
 * and every service) or creates one, echoes it on the response, and makes it available to logs.
 */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get(REQUEST_ID_HEADER);
    const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    runWithContext({ requestId: id }, next);
  };
}

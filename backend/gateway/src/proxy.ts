import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import {
  AppError,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  REQUEST_ID_HEADER,
  signInternalToken,
} from '@gilder/shared';
import type { RequestHandler } from 'express';
import type { MatchedRoute, ServiceName } from './route-table.ts';

/**
 * Forwards a matched request to its service and streams the answer back. The browser never
 * talks to a service directly: the gateway adds an internal token that proves the request came
 * through it and names the user, and passes on only the headers a service needs.
 */

export interface ProxyDeps {
  serviceUrls: Readonly<Record<ServiceName, string>>;
  privateKey: InternalKey;
  /** How long to wait for a service to start answering. A streamed answer may then run longer. */
  headersTimeoutMs?: number;
}

// Request headers a service may see. Everything else (the browser's other cookies, Origin, auth
// headers) stays at the gateway.
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'user-agent'];

// Response headers passed back to the browser. Hop-by-hop headers, Content-Length and
// Content-Encoding are left out: Node sets the framing for the streamed body itself.
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'retry-after', 'location'];

/** Sends `res.locals.route` (set by the app after matching) to its service. */
export function proxyToService(deps: ProxyDeps): RequestHandler {
  const headersTimeoutMs = deps.headersTimeoutMs ?? 10_000;

  return async (req, res) => {
    const matched = res.locals.route as MatchedRoute;
    const { service } = matched.route;
    const query = req.originalUrl.includes('?')
      ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
      : '';
    const url = `${deps.serviceUrls[service]}${matched.targetPath}${query}`;

    const headers = new Headers();
    // A webhook route also passes the sender's signature headers, and only those.
    for (const name of [...FORWARDED_REQUEST_HEADERS, ...(matched.route.webhook?.headers ?? [])]) {
      const value = req.get(name);
      if (value) {
        headers.set(name, value);
      }
    }
    headers.set(REQUEST_ID_HEADER, res.locals.requestId);
    const userId = res.locals.userId;
    headers.set(
      INTERNAL_TOKEN_HEADER,
      await signInternalToken(deps.privateKey, service, {
        ...(userId ? { userId } : {}),
        requestId: res.locals.requestId,
      }),
    );
    // Only auth owns the session cookie (it sets and ends sessions); no other service gets it.
    const cookie = req.get('cookie');
    if (service === 'auth' && cookie) {
      headers.set('cookie', cookie);
    }

    // Stop the call if the browser goes away, or if the service doesn't start answering in time.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, headersTimeoutMs);
    res.on('close', () => {
      if (!res.writableFinished) {
        controller.abort();
      }
    });

    const body = Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;
    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: req.method,
        headers,
        ...(body ? { body } : {}),
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      if (res.destroyed) {
        return;
      }
      throw new AppError(
        'service_unavailable',
        timedOut
          ? `The ${service} service did not answer in time`
          : `The ${service} service is not reachable`,
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
    }

    res.status(upstream.status);
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) {
        res.setHeader(name, value);
      }
    }
    const setCookies = upstream.headers.getSetCookie();
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    if (!upstream.body) {
      res.end();
      return;
    }
    // Pipe chunk by chunk, so a streamed answer reaches the browser as it is written.
    const stream = Readable.fromWeb(upstream.body as WebReadableStream);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  };
}

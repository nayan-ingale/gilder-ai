/**
 * The frontend's backend-for-frontend proxy. The browser only ever calls this app's own /api/*
 * routes; the Next.js server forwards each call to the gateway, whose address (GATEWAY_URL) is a
 * server-only setting the browser never sees. Answers stream straight back, so AI responses
 * arrive token by token, and Set-Cookie headers pass through, so the session cookie belongs to
 * the frontend's own domain.
 */

// What the gateway may see of the incoming request. It needs the cookie (sessions), Origin (its
// CSRF check) and the forwarded client address (its per-IP rate limit). Razorpay's webhook
// signs its body; the gateway passes these two headers on for that route only.
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'cookie',
  'origin',
  'user-agent',
  'x-forwarded-for',
  'x-razorpay-event-id',
  'x-razorpay-signature',
];

// What the browser may see of the gateway's answer. Set-Cookie is copied separately, because a
// response can carry several.
const FORWARDED_RESPONSE_HEADERS = [
  'cache-control',
  'content-type',
  'location',
  'retry-after',
  'x-request-id',
];

/** Marks requests that came through this app, so the gateway's logs can tell them apart. */
export const CLIENT_HEADER = 'x-gilder-client';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w.-]{8,128}$/;

export interface ProxyOptions {
  /** The gateway's base URL, such as http://localhost:8000. */
  gatewayUrl: string;
  /** Makes request IDs; tests pass a fixed one. */
  newRequestId?: () => string;
}

function problem(status: number, code: string, title: string, requestId: string): Response {
  return new Response(JSON.stringify({ type: `/errors/${code}`, title, status, code, requestId }), {
    status,
    headers: { 'content-type': 'application/problem+json', [REQUEST_ID_HEADER]: requestId },
  });
}

/** Forwards one browser request to the gateway and returns its answer, streamed. */
export async function forwardToGateway(request: Request, options: ProxyOptions): Promise<Response> {
  const url = new URL(request.url);
  const target = `${options.gatewayUrl.replace(/\/+$/, '')}${url.pathname}${url.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  // One request ID follows the call through the gateway and every service, and comes back in
  // the answer, so an error toast can show it. A browser-supplied ID is kept only if it is safe.
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  const requestId =
    incoming && SAFE_REQUEST_ID.test(incoming)
      ? incoming
      : (options.newRequestId ?? (() => crypto.randomUUID()))();
  headers.set(REQUEST_ID_HEADER, requestId);
  headers.set(CLIENT_HEADER, 'web');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
      redirect: 'manual',
      cache: 'no-store',
      // Aborts the gateway call when the browser goes away, which cancels a running answer.
      signal: request.signal,
    });
  } catch {
    return problem(503, 'service_unavailable', 'Service unavailable', requestId);
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

/** The gateway address from the server's settings. Never sent to the browser. */
export function gatewayUrlFromEnv(): string {
  const url = process.env.GATEWAY_URL;
  if (!url) {
    throw new Error('GATEWAY_URL is not set: copy frontend/.env.example to frontend/.env.local');
  }
  return url;
}

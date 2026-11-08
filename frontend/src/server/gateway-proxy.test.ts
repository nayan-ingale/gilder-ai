import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { forwardToGateway } from './gateway-proxy';

/** A stand-in gateway on a real port. `answer` decides how it replies. */
let gateway: Server;
let gatewayUrl: string;
let seen: { method: string; url: string; headers: IncomingHttpHeaders; body: string }[] = [];
let answer: (req: IncomingMessage, res: ServerResponse) => void;

beforeAll(async () => {
  gateway = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += String(chunk)));
    req.on('end', () => {
      seen.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      answer(req, res);
    });
  });
  await new Promise<void>((resolve) => gateway.listen(0, resolve));
  gatewayUrl = `http://localhost:${(gateway.address() as AddressInfo).port}`;
});

afterAll(async () => {
  gateway.closeAllConnections();
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
});

afterEach(() => {
  seen = [];
});

const browserRequest = (path: string, init: RequestInit = {}) =>
  new Request(`http://localhost:3000${path}`, init);

describe('forwardToGateway', () => {
  it('forwards the path, query, body and the headers the gateway needs', async () => {
    answer = (_req, res) => res.end('{}');

    await forwardToGateway(
      browserRequest('/api/me?x=1', {
        method: 'PATCH',
        headers: {
          cookie: 'gilder_sid=abc',
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
          authorization: 'Bearer leak',
          'x-custom': 'nope',
        },
        body: '{ "themePreference": "dark" }',
      }),
      { gatewayUrl, newRequestId: () => 'req-fixed-0001' },
    );

    const [forwarded] = seen;
    expect(forwarded).toMatchObject({
      method: 'PATCH',
      url: '/api/me?x=1',
      body: '{ "themePreference": "dark" }',
    });
    expect(forwarded?.headers).toMatchObject({
      cookie: 'gilder_sid=abc',
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      'x-request-id': 'req-fixed-0001',
      'x-gilder-client': 'web',
    });
    expect(forwarded?.headers.authorization).toBeUndefined();
    expect(forwarded?.headers['x-custom']).toBeUndefined();
  });

  it("keeps the browser's request ID when it is safe, and replaces it otherwise", async () => {
    answer = (_req, res) => res.end();
    const send = (id: string) =>
      forwardToGateway(browserRequest('/api/me', { headers: { 'x-request-id': id } }), {
        gatewayUrl,
        newRequestId: () => 'req-generated-1',
      });

    await send('req-from-browser');
    await send('bad id" injected');

    expect(seen.map((request) => request.headers['x-request-id'])).toEqual([
      'req-from-browser',
      'req-generated-1',
    ]);
  });

  it("returns the gateway's status, cookies and request ID, and nothing else", async () => {
    answer = (_req, res) => {
      res.statusCode = 201;
      res.setHeader('content-type', 'application/json');
      res.setHeader('set-cookie', ['gilder_sid=new; HttpOnly', 'other=1']);
      res.setHeader('x-request-id', 'req-from-gateway');
      res.setHeader('x-powered-by', 'leaky');
      res.end('{"ok":true}');
    };

    const response = await forwardToGateway(browserRequest('/api/auth/session'), { gatewayUrl });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.getSetCookie()).toEqual(['gilder_sid=new; HttpOnly', 'other=1']);
    expect(response.headers.get('x-request-id')).toBe('req-from-gateway');
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('streams the answer instead of waiting for the end', async () => {
    answer = (_req, res) => {
      res.setHeader('content-type', 'text/event-stream');
      res.write('data: first\n\n');
      setTimeout(() => res.end('data: last\n\n'), 400);
    };
    const started = Date.now();

    const response = await forwardToGateway(browserRequest('/api/turns'), { gatewayUrl });
    const reader = response.body!.getReader();
    const first = await reader.read();
    const firstAt = Date.now() - started;
    while (!(await reader.read()).done) {
      // Reads to the end.
    }

    expect(new TextDecoder().decode(first.value)).toContain('first');
    expect(firstAt).toBeLessThan(300);
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
  });

  it('answers 503 problem+json with the request ID when the gateway is down', async () => {
    const response = await forwardToGateway(browserRequest('/api/me'), {
      gatewayUrl: 'http://localhost:1',
      newRequestId: () => 'req-down-00001',
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({
      code: 'service_unavailable',
      requestId: 'req-down-00001',
    });
  });

  it('cancels the gateway call when the browser goes away', async () => {
    let gatewaySawClose!: () => void;
    const closed = new Promise<void>((resolve) => (gatewaySawClose = resolve));
    answer = (req, res) => {
      res.write('data: started\n\n');
      req.socket.on('close', () => gatewaySawClose());
    };
    const browser = new AbortController();

    const response = await forwardToGateway(
      browserRequest('/api/turns', { signal: browser.signal }),
      {
        gatewayUrl,
      },
    );
    await response.body!.getReader().read();
    browser.abort();

    await expect(closed).resolves.toBeUndefined();
  });
});

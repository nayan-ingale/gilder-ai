import {
  createServer,
  type IncomingMessage,
  request as httpRequest,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createLogger,
  createService,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  verifyInternalToken,
} from '@gilder/shared';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { proxyToService } from './proxy.ts';
import type { MatchedRoute, ServiceName } from './route-table.ts';

const logger = createLogger({ service: 'gateway', level: 'silent' });
let privateKey: InternalKey;
let publicKey: InternalKey;

interface SeenRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

/** A stand-in service on a real port. `handle` decides how it answers each request. */
let upstream: Server;
let upstreamUrl: string;
let seen: SeenRequest[] = [];
let handle: (req: IncomingMessage, res: ServerResponse) => void;

beforeAll(async () => {
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
  upstream = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += String(chunk)));
    req.on('end', () => {
      seen.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      handle(req, res);
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, resolve));
  upstreamUrl = `http://localhost:${(upstream.address() as AddressInfo).port}`;
});

afterAll(async () => {
  upstream.closeAllConnections();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

afterEach(() => {
  seen = [];
});

function route(service: ServiceName, targetPath: string): MatchedRoute {
  return {
    route: { method: 'POST', path: '/api/x', service, target: targetPath, session: 'none' },
    targetPath,
  };
}

/** A gateway that sends every request to `matched`, as the user `userId` when given. */
function gateway(
  matched: MatchedRoute,
  options: { userId?: string; headersTimeoutMs?: number } = {},
): Express {
  const urls = { auth: upstreamUrl, chat: upstreamUrl, agent: upstreamUrl, billing: upstreamUrl };
  return createService({
    name: 'gateway',
    logger,
    parseJson: false,
    routes: (app) => {
      app.use(express.raw({ type: () => true, limit: '1mb' }), (_req, res, next) => {
        res.locals.route = matched;
        if (options.userId) {
          res.locals.userId = options.userId;
        }
        next();
      });
      app.use(
        proxyToService({
          serviceUrls: urls,
          privateKey,
          ...(options.headersTimeoutMs ? { headersTimeoutMs: options.headersTimeoutMs } : {}),
        }),
      );
    },
  });
}

describe('proxyToService', () => {
  it('forwards the method, path, query and exact body bytes, with a token for the service', async () => {
    handle = (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end('{"ok":true}');
    };
    const raw = '{ "b": 1,   "a": [2] }';

    const response = await request(gateway(route('chat', '/chats/abc'), { userId: 'user-1' }))
      .post('/api/x?cursor=5&query=hi')
      .set('content-type', 'application/json')
      .set('x-request-id', 'req-12345678')
      .send(raw);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    const [forwarded] = seen;
    expect(forwarded).toMatchObject({
      method: 'POST',
      url: '/chats/abc?cursor=5&query=hi',
      body: raw,
    });
    expect(forwarded?.headers['x-request-id']).toBe('req-12345678');
    const token = String(forwarded?.headers[INTERNAL_TOKEN_HEADER]);
    await expect(verifyInternalToken(token, { gateway: publicKey }, 'chat')).resolves.toEqual({
      caller: 'gateway',
      userId: 'user-1',
      requestId: 'req-12345678',
    });
  });

  it('signs a token with no user for a request with no session', async () => {
    handle = (_req, res) => res.end();

    await request(gateway(route('auth', '/sessions')))
      .post('/api/x')
      .send('{}');

    const token = String(seen[0]?.headers[INTERNAL_TOKEN_HEADER]);
    expect(await verifyInternalToken(token, { gateway: publicKey }, 'auth')).not.toHaveProperty(
      'userId',
    );
  });

  it('passes the cookie to auth only, and keeps other browser headers at the gateway', async () => {
    handle = (_req, res) => res.end();
    const send = (service: ServiceName) =>
      request(gateway(route(service, '/x')))
        .post('/api/x')
        .set('Cookie', 'gilder_sid=abc; theme=dark')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', 'Bearer something');

    await send('auth');
    await send('chat');

    expect(seen[0]?.headers.cookie).toBe('gilder_sid=abc; theme=dark');
    expect(seen[1]?.headers.cookie).toBeUndefined();
    for (const forwarded of seen) {
      expect(forwarded.headers.origin).toBeUndefined();
      expect(forwarded.headers.authorization).toBeUndefined();
    }
  });

  it("returns the service's status, Set-Cookie headers and content type", async () => {
    handle = (_req, res) => {
      res.statusCode = 201;
      res.setHeader('content-type', 'application/problem+json');
      res.setHeader('set-cookie', ['gilder_sid=new; HttpOnly', 'other=1']);
      res.setHeader('x-powered-by', 'leaky');
      res.end('{"code":"created"}');
    };

    const response = await request(gateway(route('auth', '/sessions'))).post('/api/x');

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.headers['set-cookie']).toEqual(['gilder_sid=new; HttpOnly', 'other=1']);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('streams the answer chunk by chunk instead of waiting for the end', async () => {
    handle = (_req, res) => {
      res.setHeader('content-type', 'text/event-stream');
      res.write('data: first\n\n');
      setTimeout(() => res.end('data: last\n\n'), 400);
    };
    const app = gateway(route('agent', '/turns'));
    const server = app.listen(0);
    const port = (server.address() as AddressInfo).port;

    const timings = await new Promise<{ first: number; end: number }>((resolve, reject) => {
      const started = Date.now();
      let first = 0;
      httpRequest({ port, method: 'POST', path: '/api/x' }, (res) => {
        res.on('data', () => {
          first ||= Date.now() - started;
        });
        res.on('end', () => resolve({ first, end: Date.now() - started }));
      })
        .on('error', reject)
        .end();
    });
    server.close();

    expect(timings.first).toBeLessThan(300);
    expect(timings.end).toBeGreaterThanOrEqual(400);
  });

  it('answers 503 when the service is down or does not answer in time', async () => {
    handle = () => {
      // Never answers.
    };
    const slow = await request(gateway(route('chat', '/x'), { headersTimeoutMs: 200 })).post(
      '/api/x',
    );
    const downApp = createService({
      name: 'gateway',
      logger,
      parseJson: false,
      routes: (app) => {
        app.use((_req, res, next) => {
          res.locals.route = route('chat', '/x');
          next();
        });
        app.use(
          proxyToService({
            serviceUrls: {
              auth: 'http://localhost:1',
              chat: 'http://localhost:1',
              agent: 'http://localhost:1',
              billing: 'http://localhost:1',
            },
            privateKey,
          }),
        );
      },
    });
    const down = await request(downApp).post('/api/x');

    for (const response of [slow, down]) {
      expect(response.status).toBe(503);
      expect(response.body.code).toBe('service_unavailable');
    }
  });

  it('cancels the call to the service when the browser disconnects', async () => {
    let serviceSawClose!: () => void;
    const closed = new Promise<void>((resolve) => (serviceSawClose = resolve));
    handle = (req, res) => {
      res.setHeader('content-type', 'text/event-stream');
      res.write('data: started\n\n');
      req.socket.on('close', () => serviceSawClose());
    };
    const server = gateway(route('agent', '/turns')).listen(0);
    const port = (server.address() as AddressInfo).port;

    const client = httpRequest({ port, method: 'POST', path: '/api/x' }, (res) => {
      res.once('data', () => client.destroy());
    });
    client.on('error', () => {});
    client.end();

    await expect(closed).resolves.toBeUndefined();
    server.close();
  });
});

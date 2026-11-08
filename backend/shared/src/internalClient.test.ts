import { once } from 'node:events';
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runWithContext } from './context.ts';
import { AppError, errorHandler } from './errors.ts';
import { createInternalClient } from './internalClient.ts';
import {
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  type InternalKey,
  requireCaller,
  requireInternalToken,
} from './internalToken.ts';
import { createLogger } from './logger.ts';

let gatewayPublicKey: InternalKey;
let authPrivateKey: InternalKey;
let authPublicKey: InternalKey;
let server: Server | undefined;

beforeAll(async () => {
  gatewayPublicKey = await importInternalPublicKey((await generateInternalKeyPair()).publicKey);
  const pair = await generateInternalKeyPair();
  authPrivateKey = await importInternalPrivateKey(pair.privateKey);
  authPublicKey = await importInternalPublicKey(pair.publicKey);
});

afterEach(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
    server = undefined;
  }
});

async function serve(handler: RequestListener): Promise<string> {
  server = createServer(handler);
  server.listen(0);
  await once(server, 'listening');
  return `http://localhost:${(server.address() as AddressInfo).port}`;
}

/** A billing-like service that trusts auth's key and only lets auth use the route. */
function billing() {
  const app = express();
  app.use(express.json());
  app.use(requireInternalToken({ gateway: gatewayPublicKey, auth: authPublicKey }, 'billing'));
  app.post('/internal/accounts', requireCaller('auth'), (req, res) => {
    res.status(201).json({
      userId: res.locals.userId,
      caller: res.locals.caller,
      requestId: req.get('x-request-id'),
      body: req.body,
    });
  });
  app.post('/internal/broke', (_req, res) => {
    res.status(402).json({ code: 'insufficient_credits', detail: 'Not enough credits' });
  });
  app.use(errorHandler(createLogger({ service: 'test', level: 'silent' })));
  return app;
}

const client = (baseUrl: string, timeoutMs?: number) =>
  createInternalClient({
    caller: 'auth',
    privateKey: authPrivateKey,
    service: 'billing',
    baseUrl,
    ...(timeoutMs ? { timeoutMs } : {}),
  });

describe('createInternalClient', () => {
  it("calls as its own service, for the user and the current request's ID", async () => {
    const url = await serve(billing());

    const result = await runWithContext({ requestId: 'req-42' }, () =>
      client(url).request('POST', '/internal/accounts', { userId: 'u1', body: { a: 1 } }),
    );

    expect(result).toEqual({ userId: 'u1', caller: 'auth', requestId: 'req-42', body: { a: 1 } });
  });

  it("keeps the other service's error code, such as 402", async () => {
    const url = await serve(billing());

    await expect(client(url).request('POST', '/internal/broke')).rejects.toMatchObject({
      code: 'insufficient_credits',
      status: 402,
      message: 'Not enough credits',
    });
  });

  it('turns a 5xx, a timeout or a refused connection into service_unavailable', async () => {
    const failing = await serve((_req, res) => {
      res.statusCode = 500;
      res.end('{}');
    });
    await expect(client(failing).request('GET', '/x')).rejects.toMatchObject({
      code: 'service_unavailable',
    });
    server?.close();
    server = undefined;

    const silent = await serve(() => {});
    await expect(client(silent, 100).request('GET', '/x')).rejects.toBeInstanceOf(AppError);

    await expect(client('http://localhost:1').request('GET', '/x')).rejects.toMatchObject({
      code: 'service_unavailable',
    });
  });

  it('retries once when asked, and only then', async () => {
    let calls = 0;
    const flaky = await serve((_req, res) => {
      calls += 1;
      res.statusCode = calls === 1 ? 503 : 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ calls }));
    });

    await expect(client(flaky).request('POST', '/x', { retry: true })).resolves.toEqual({
      calls: 2,
    });
    calls = 0;
    await expect(client(flaky).request('POST', '/x')).rejects.toMatchObject({
      code: 'service_unavailable',
    });
  });
});

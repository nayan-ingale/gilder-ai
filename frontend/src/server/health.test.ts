import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { siteHealth } from './health';

/** A stand-in gateway; `answer` decides how /readyz replies. */
let gateway: Server;
let gatewayUrl: string;
let paths: string[] = [];
let answer: (req: IncomingMessage, res: ServerResponse) => void = () => {};

beforeAll(async () => {
  gateway = createServer((req, res) => {
    paths.push(req.url ?? '');
    answer(req, res);
  });
  await new Promise<void>((resolve) => gateway.listen(0, resolve));
  gatewayUrl = `http://localhost:${(gateway.address() as AddressInfo).port}`;
});

afterAll(async () => {
  gateway.closeAllConnections();
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
});

describe('siteHealth', () => {
  it('is ok when the gateway is ready', async () => {
    paths = [];
    answer = (_req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end('{}');

    const response = await siteHealth(gatewayUrl);

    expect(paths).toEqual(['/readyz']);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it("is unavailable when the gateway isn't ready, without passing on its details", async () => {
    answer = (_req, res) =>
      res
        .writeHead(503, { 'content-type': 'application/json' })
        .end('{"status":"not_ready","checks":{"redis":"failed"}}');

    const response = await siteHealth(gatewayUrl);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the gateway is too slow', async () => {
    answer = (_req, res) => {
      setTimeout(() => res.writeHead(200).end('{}'), 500);
    };

    const response = await siteHealth(gatewayUrl, 50);

    expect(response.status).toBe(503);
  });

  it("is unavailable when the gateway can't be reached", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    const response = await siteHealth(`http://localhost:${port}`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });
});

import { Agent, get } from 'node:http';
import { Writable } from 'node:stream';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from './errors.ts';
import {
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  signInternalToken,
} from './internalToken.ts';
import { createLogger } from './logger.ts';
import { createService, startService } from './service.ts';
import { validate } from './validate.ts';

const logger = createLogger({ service: 'test', level: 'silent' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface LogLine {
  msg?: string;
  req?: { method: string; url: string };
}

/** A logger whose lines the test can read. */
function captureLogs() {
  const lines: LogLine[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)) as LogLine);
      callback();
    },
  });
  return { lines, logger: createLogger({ service: 'test', destination }) };
}

/** A GET over a keep-alive connection; resolves with the status once the body has arrived. */
function getStatus(port: number, path: string, agent: Agent): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    get({ port, path, agent }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    }).on('error', reject);
  });
}

function buildApp(readinessChecks = {}, bodyLimit?: string) {
  return createService({
    name: 'test',
    logger,
    readinessChecks,
    ...(bodyLimit ? { bodyLimit } : {}),
    routes: (app) => {
      app.get('/forbidden', () => {
        throw new AppError('forbidden', 'This chat belongs to someone else');
      });
      app.get('/crash', () => {
        throw new Error('db password=hunter2 is wrong');
      });
      app.get('/async-crash', async () => {
        await Promise.resolve();
        throw new Error('async failure');
      });
      app.post('/echo', (req, res) => {
        res.json(req.body);
      });
      app.post(
        '/items',
        validate({ body: z.object({ name: z.string().min(1), tags: z.array(z.string()).max(3) }) }),
        (req, res) => {
          res.status(201).json(req.body);
        },
      );
      app.get(
        '/search',
        validate({ query: z.object({ limit: z.coerce.number().int().max(50) }) }),
        (req, res) => {
          res.json({ limit: req.query.limit, type: typeof req.query.limit });
        },
      );
    },
  });
}

describe('health endpoints', () => {
  it('/healthz answers without checking dependencies', async () => {
    const response = await request(buildApp()).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'test' });
  });

  it('/readyz is 200 when every check passes', async () => {
    const response = await request(buildApp({ db: async () => {} })).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', service: 'test', checks: { db: 'ok' } });
  });

  it('/readyz is 503 when a check fails, without exposing why', async () => {
    const app = buildApp({
      db: async () => {},
      cache: async () => {
        throw new Error('connection refused to 10.0.0.5');
      },
    });
    const response = await request(app).get('/readyz');

    expect(response.status).toBe(503);
    expect(response.body.checks).toEqual({ db: 'ok', cache: 'failed' });
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.5');
  });
});

describe('request IDs', () => {
  it('reuses a valid incoming X-Request-Id', async () => {
    const response = await request(buildApp()).get('/healthz').set('x-request-id', 'abc-12345678');

    expect(response.headers['x-request-id']).toBe('abc-12345678');
  });

  it('creates one when missing, and replaces unsafe values', async () => {
    const missing = await request(buildApp()).get('/healthz');
    const unsafe = await request(buildApp())
      .get('/healthz')
      .set('x-request-id', 'fake id" level="error');

    expect(missing.headers['x-request-id']).toMatch(UUID);
    expect(unsafe.headers['x-request-id']).toMatch(UUID);
  });
});

describe('request logging', () => {
  it('skips GET and HEAD health probes, but logs anything else on those paths', async () => {
    const logs = captureLogs();
    const app = createService({ name: 'test', logger: logs.logger });

    await request(app).get('/healthz');
    await request(app).head('/readyz');
    await request(app).get('/healthz?probe=1');
    await request(app).post('/healthz');
    await request(app).delete('/readyz');
    await request(app).get('/nothing-here');

    const logged = logs.lines
      .filter((line) => line.msg === 'request completed')
      .map((line) => `${line.req?.method} ${line.req?.url}`);
    expect(logged).toEqual(['POST /healthz', 'DELETE /readyz', 'GET /nothing-here']);
  });
});

describe('errors', () => {
  it('answers unknown routes with a 404 problem+json carrying the request ID', async () => {
    const response = await request(buildApp()).get('/nothing-here');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      status: 404,
      code: 'not_found',
      title: 'Not found',
      detail: 'No route for GET /nothing-here',
      requestId: response.headers['x-request-id'],
    });
  });

  it('turns an AppError into its status and message', async () => {
    const response = await request(buildApp()).get('/forbidden');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'forbidden',
      detail: 'This chat belongs to someone else',
    });
  });

  it('hides the details of unexpected errors behind a generic 500', async () => {
    for (const path of ['/crash', '/async-crash']) {
      const response = await request(buildApp()).get(path);

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('internal_error');
      expect(response.body).not.toHaveProperty('detail');
      expect(JSON.stringify(response.body)).not.toContain('hunter2');
    }
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await request(buildApp())
      .post('/echo')
      .set('content-type', 'application/json')
      .send('{"broken": ');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('bad_request');
  });

  it('rejects bodies over the size limit with 413', async () => {
    const response = await request(buildApp({}, '1kb'))
      .post('/echo')
      .send({ text: 'x'.repeat(2_000) });

    expect(response.status).toBe(413);
    expect(response.body.code).toBe('payload_too_large');
  });

  it('rejects a JSON body in a charset other than UTF with 415', async () => {
    const response = await request(buildApp())
      .post('/echo')
      .set('content-type', 'application/json; charset=latin1')
      .send('{"name": "x"}');

    expect(response.status).toBe(415);
    expect(response.body).toMatchObject({
      code: 'unsupported_media_type',
      detail: 'The request body uses an unsupported charset',
    });
  });

  it('rejects a body with an unknown Content-Encoding with 415', async () => {
    const response = await request(buildApp())
      .post('/echo')
      .set('content-type', 'application/json')
      .set('content-encoding', 'compress')
      .send('{"name": "x"}');

    expect(response.status).toBe(415);
    expect(response.body).toMatchObject({
      code: 'unsupported_media_type',
      detail: 'The request body uses an unsupported Content-Encoding',
    });
  });
});

describe('validate()', () => {
  it('returns 400 listing every invalid field', async () => {
    const response = await request(buildApp())
      .post('/items')
      .send({ name: '', tags: ['a', 'b', 'c', 'd'] });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_failed');
    expect(response.body.errors.map((error: { path: string }) => error.path)).toEqual([
      'body.name',
      'body.tags',
    ]);
  });

  it('passes the parsed, converted values to the handler', async () => {
    const valid = await request(buildApp()).get('/search?limit=5');
    const invalid = await request(buildApp()).get('/search?limit=abc');

    expect(valid.body).toEqual({ limit: 5, type: 'number' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors[0].path).toBe('query.limit');
  });
});

describe('internalAuth', () => {
  let privateKey: InternalKey;
  let publicKey: InternalKey;

  beforeAll(async () => {
    const pair = await generateInternalKeyPair();
    privateKey = await importInternalPrivateKey(pair.privateKey);
    publicKey = await importInternalPublicKey(pair.publicKey);
  });

  function buildLockedApp() {
    return createService({
      name: 'chat',
      logger,
      internalAuth: { publicKey, audience: 'chat' },
      routes: (app) => {
        app.get('/chats', (_req, res) => {
          res.json({ userId: res.locals.userId });
        });
      },
    });
  }

  it('keeps the health checks open', async () => {
    const app = buildLockedApp();

    expect((await request(app).get('/healthz')).status).toBe(200);
    expect((await request(app).get('/readyz')).status).toBe(200);
  });

  it('answers 401 to a direct call on any other path, whether it exists or not', async () => {
    for (const path of ['/chats', '/nothing-here', '/internal/users/1']) {
      const response = await request(buildLockedApp()).get(path);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('unauthorized');
    }
  });

  it('serves a call with a valid token, and answers 404 for a path that does not exist', async () => {
    const token = await signInternalToken(privateKey, 'chat', { userId: 'user-1' });
    const app = buildLockedApp();

    const known = await request(app).get('/chats').set(INTERNAL_TOKEN_HEADER, token);
    const unknown = await request(app).get('/nothing-here').set(INTERNAL_TOKEN_HEADER, token);

    expect(known.status).toBe(200);
    expect(known.body).toEqual({ userId: 'user-1' });
    expect(unknown.status).toBe(404);
  });

  it('rejects a token addressed to another service', async () => {
    const token = await signInternalToken(privateKey, 'billing', { userId: 'user-1' });
    const response = await request(buildLockedApp())
      .get('/chats')
      .set(INTERNAL_TOKEN_HEADER, token);

    expect(response.status).toBe(401);
  });
});

describe('parseJson: false', () => {
  it('leaves the body unread, byte for byte, even when it is not valid JSON', async () => {
    const app = createService({
      name: 'gateway',
      logger,
      parseJson: false,
      routes: (routes) => {
        routes.post('/raw', async (req, res) => {
          let body = '';
          for await (const chunk of req) {
            body += String(chunk);
          }
          res.json({ parsed: req.body !== undefined, body });
        });
      },
    });

    // Spacing and key order that a parse-and-reserialize would lose, then broken JSON.
    for (const sent of ['{ "b": 1,   "a": [2, 3] }', '{"broken": ']) {
      const response = await request(app)
        .post('/raw')
        .set('content-type', 'application/json')
        .send(sent);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ parsed: false, body: sent });
    }
  });
});

describe('startService', () => {
  it('serves requests, then shuts down and runs the cleanup hook', async () => {
    let cleanedUp = false;
    const running = await startService(buildApp(), {
      port: 0,
      logger,
      handleSignals: false,
      onShutdown: async () => {
        cleanedUp = true;
      },
    });

    const response = await fetch(`http://localhost:${running.port}/healthz`);
    expect(response.status).toBe(200);

    await running.close();
    expect(cleanedUp).toBe(true);
    await expect(fetch(`http://localhost:${running.port}/healthz`)).rejects.toThrow();
  });

  it('closes a keep-alive connection as soon as its last request finishes', async () => {
    let arrived!: () => void;
    const requestArrived = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    const app = createService({
      name: 'test',
      logger,
      routes: (routes) => {
        routes.get('/slow', (_req, res) => {
          arrived();
          setTimeout(() => res.json({ done: true }), 200);
        });
      },
    });
    const running = await startService(app, { port: 0, logger, handleSignals: false });
    const agent = new Agent({ keepAlive: true });

    try {
      const slow = getStatus(running.port, '/slow', agent);
      await requestArrived;
      const started = Date.now();
      const [status] = await Promise.all([slow, running.close()]);

      expect(status).toBe(200);
      // Left open, the idle connection would hold the shutdown up for about 6 seconds. It takes
      // about 0.2 here; the margin is for a busy machine.
      expect(Date.now() - started).toBeLessThan(3_000);
    } finally {
      agent.destroy();
    }
  });

  it('shuts down once when one Ctrl+C delivers SIGINT twice', async () => {
    const before = { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM') };
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const logs = captureLogs();
    let cleanups = 0;

    try {
      await startService(createService({ name: 'test', logger }), {
        port: 0,
        logger: logs.logger,
        onShutdown: async () => {
          cleanups += 1;
        },
      });

      // Under `node --watch` the terminal and the watcher each pass the Ctrl+C on to the app.
      process.emit('SIGINT', 'SIGINT');
      process.emit('SIGINT', 'SIGINT');
      await vi.waitFor(() => expect(exit).toHaveBeenCalled(), { timeout: 4_000 });

      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(0);
      expect(cleanups).toBe(1);
      expect(logs.lines.map((line) => line.msg)).toEqual([
        'listening',
        'shutting down',
        'already shutting down',
        'shut down cleanly',
      ]);
      // Still listening, so a real second SIGINT never falls back to Node's default: killing the
      // process.
      expect(process.listenerCount('SIGINT')).toBe(before.SIGINT.length + 1);
    } finally {
      exit.mockRestore();
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        for (const listener of process.listeners(signal)) {
          if (!before[signal].includes(listener)) {
            process.off(signal, listener);
          }
        }
      }
    }
  });
});

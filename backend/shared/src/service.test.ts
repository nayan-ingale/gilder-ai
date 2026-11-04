import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from './errors.ts';
import { createLogger } from './logger.ts';
import { createService, startService } from './service.ts';
import { validate } from './validate.ts';

const logger = createLogger({ service: 'test', level: 'silent' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
});

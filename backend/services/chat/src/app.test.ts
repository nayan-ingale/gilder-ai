import { createLogger } from '@gilder/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

const logger = createLogger({ service: 'chat', level: 'silent' });

describe('chat', () => {
  it('answers the health check', async () => {
    const response = await request(createApp({ logger })).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'chat' });
  });

  it('reports readiness from its dependency checks', async () => {
    const app = createApp({ logger, readinessChecks: { dependency: async () => {} } });
    const response = await request(app).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body.checks).toEqual({ dependency: 'ok' });
  });

  it('answers unknown routes with a problem+json 404', async () => {
    const response = await request(createApp({ logger })).get('/nothing-here');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('not_found');
  });
});

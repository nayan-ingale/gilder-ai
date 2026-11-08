import express from 'express';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from './errors.ts';
import {
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  requireCaller,
  requireInternalToken,
  requireUser,
  signInternalToken,
  verifyInternalToken,
} from './internalToken.ts';
import { createLogger } from './logger.ts';

let privateKey: InternalKey;
let publicKey: InternalKey;
let otherPrivateKey: InternalKey;
let authPrivateKey: InternalKey;
let authPublicKey: InternalKey;

beforeAll(async () => {
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
  otherPrivateKey = await importInternalPrivateKey((await generateInternalKeyPair()).privateKey);
  const authPair = await generateInternalKeyPair();
  authPrivateKey = await importInternalPrivateKey(authPair.privateKey);
  authPublicKey = await importInternalPublicKey(authPair.publicKey);
});

describe('internal tokens', () => {
  it('round-trips the user and request ID', async () => {
    const token = await signInternalToken(privateKey, 'chat', {
      userId: 'user-1',
      requestId: 'req-1',
    });

    await expect(verifyInternalToken(token, { gateway: publicKey }, 'chat')).resolves.toEqual({
      caller: 'gateway',
      userId: 'user-1',
      requestId: 'req-1',
    });
  });

  it('signs a token with no user for a request with no session', async () => {
    const token = await signInternalToken(privateKey, 'auth', { requestId: 'req-2' });

    expect(decodeJwt(token)).not.toHaveProperty('sub');
    await expect(verifyInternalToken(token, { gateway: publicKey }, 'auth')).resolves.toEqual({
      caller: 'gateway',
      requestId: 'req-2',
    });
  });

  it('rejects a token addressed to another service', async () => {
    const token = await signInternalToken(privateKey, 'billing', { userId: 'user-1' });

    await expect(verifyInternalToken(token, { gateway: publicKey }, 'chat')).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await signInternalToken(privateKey, 'chat', { userId: 'user-1' }, 60);
    const twoMinutesLater = new Date(Date.now() + 120_000);

    await expect(
      verifyInternalToken(token, { gateway: publicKey }, 'chat', twoMinutesLater),
    ).rejects.toThrow();
  });

  it('rejects a token signed with a different key', async () => {
    const forged = await signInternalToken(otherPrivateKey, 'chat', { userId: 'admin' });

    await expect(verifyInternalToken(forged, { gateway: publicKey }, 'chat')).rejects.toThrow();
  });
});

describe('tokens from other services', () => {
  it("accepts a service's token only where that service is trusted", async () => {
    const token = await signInternalToken(authPrivateKey, 'billing', { userId: 'u1' }, 60, 'auth');

    await expect(
      verifyInternalToken(token, { gateway: publicKey, auth: authPublicKey }, 'billing'),
    ).resolves.toEqual({ caller: 'auth', userId: 'u1' });
    await expect(verifyInternalToken(token, { gateway: publicKey }, 'billing')).rejects.toThrow(
      'tokens from gilder-auth are not trusted here',
    );
  });

  it("can't pass a service's key off as the gateway's, or the other way round", async () => {
    const trusted = { gateway: publicKey, auth: authPublicKey };
    const claimsGateway = await signInternalToken(authPrivateKey, 'billing', { userId: 'u1' });
    const claimsAuth = await signInternalToken(privateKey, 'billing', { userId: 'u1' }, 60, 'auth');

    await expect(verifyInternalToken(claimsGateway, trusted, 'billing')).rejects.toThrow();
    await expect(verifyInternalToken(claimsAuth, trusted, 'billing')).rejects.toThrow();
  });
});

describe('requireCaller()', () => {
  function buildApp() {
    const app = express();
    app.post(
      '/internal/accounts',
      requireInternalToken({ gateway: publicKey, auth: authPublicKey }, 'billing'),
      requireCaller('auth'),
      (_req, res) => {
        res.json({ caller: res.locals.caller });
      },
    );
    app.use(errorHandler(createLogger({ service: 'test', level: 'silent' })));
    return app;
  }

  it('lets only the named services use the route', async () => {
    const fromAuth = await signInternalToken(authPrivateKey, 'billing', {}, 60, 'auth');
    const fromGateway = await signInternalToken(privateKey, 'billing', { userId: 'u1' });

    const allowed = await request(buildApp())
      .post('/internal/accounts')
      .set(INTERNAL_TOKEN_HEADER, fromAuth);
    const refused = await request(buildApp())
      .post('/internal/accounts')
      .set(INTERNAL_TOKEN_HEADER, fromGateway);

    expect(allowed.body).toEqual({ caller: 'auth' });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('forbidden');
  });
});

describe('requireInternalToken()', () => {
  function buildApp() {
    const app = express();
    app.get(
      '/internal/whoami',
      requireInternalToken({ gateway: publicKey }, 'chat'),
      (_req, res) => {
        res.json({ userId: res.locals.userId });
      },
    );
    app.use(errorHandler(createLogger({ service: 'test', level: 'silent' })));
    return app;
  }

  it('lets a valid token through and exposes the user', async () => {
    const token = await signInternalToken(privateKey, 'chat', { userId: 'user-1' });
    const response = await request(buildApp())
      .get('/internal/whoami')
      .set(INTERNAL_TOKEN_HEADER, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'user-1' });
  });

  it('answers 401 without a token, or with a bad one', async () => {
    const missing = await request(buildApp()).get('/internal/whoami');
    const garbage = await request(buildApp())
      .get('/internal/whoami')
      .set(INTERNAL_TOKEN_HEADER, 'not-a-jwt');
    const forged = await request(buildApp())
      .get('/internal/whoami')
      .set(
        INTERNAL_TOKEN_HEADER,
        await signInternalToken(otherPrivateKey, 'chat', { userId: 'x' }),
      );

    for (const response of [missing, garbage, forged]) {
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('unauthorized');
    }
  });

  it('lets a token with no user through, with no user set', async () => {
    const token = await signInternalToken(privateKey, 'chat', {});
    const response = await request(buildApp())
      .get('/internal/whoami')
      .set(INTERNAL_TOKEN_HEADER, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
  });
});

describe('requireUser()', () => {
  function buildApp() {
    const app = express();
    app.get(
      '/me',
      requireInternalToken({ gateway: publicKey }, 'auth'),
      requireUser(),
      (_req, res) => {
        res.json({ userId: res.locals.userId });
      },
    );
    app.use(errorHandler(createLogger({ service: 'test', level: 'silent' })));
    return app;
  }

  it('lets a token that names a user through', async () => {
    const token = await signInternalToken(privateKey, 'auth', { userId: 'user-1' });
    const response = await request(buildApp()).get('/me').set(INTERNAL_TOKEN_HEADER, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'user-1' });
  });

  it('answers 401 to a valid token with no user', async () => {
    const token = await signInternalToken(privateKey, 'auth', {});
    const response = await request(buildApp()).get('/me').set(INTERNAL_TOKEN_HEADER, token);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'unauthorized',
      detail: 'This route needs a signed-in user',
    });
  });
});

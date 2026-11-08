import {
  AppError,
  createLogger,
  createService,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  resolveSession,
  signInternalToken,
} from '@gilder/shared';
import {
  createTestRedis,
  startTestMongo,
  type TestMongo,
  type TestRedis,
} from '@gilder/shared/testing';
import request, { type Response } from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleSignInNotSetUp, type VerifyIdToken } from './firebase.ts';
import { type SessionRouteDeps, sessionRouter } from './session-routes.ts';
import { UserModel } from './users.ts';

const logger = createLogger({ service: 'auth', level: 'silent' });
let mongo: TestMongo;
let store: TestRedis;
let privateKey: InternalKey;
let publicKey: InternalKey;

beforeAll(async () => {
  mongo = await startTestMongo();
  await UserModel.init();
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

/** Stands in for billing's sign-up grant. */
const grants = vi.fn<(userId: string) => Promise<void>>(async () => {});

beforeEach(async () => {
  store = await createTestRedis();
  await UserModel.deleteMany({});
  grants.mockReset();
  grants.mockImplementation(async () => {});
});

afterEach(async () => {
  await store.cleanup();
});

/** Stands in for Firebase: only 'good-token' is a valid Google sign-in. */
const fakeFirebase: VerifyIdToken = async (idToken) => {
  if (idToken !== 'good-token') {
    throw new AppError('unauthorized', 'The Google sign-in is not valid. Sign in again.');
  }
  return { firebaseUid: 'google-uid-1', email: 'nayan@example.com', name: 'Nayan' };
};

/** Auth as it runs behind the gateway: every route needs an internal token. */
function buildApp(overrides: Partial<SessionRouteDeps> = {}) {
  return createService({
    name: 'auth',
    logger,
    internalAuth: { publicKey, audience: 'auth' },
    routes: (app) => {
      app.use(
        sessionRouter({
          redis: store.redis,
          verifyIdToken: fakeFirebase,
          devLogin: true,
          secureCookie: false,
          grantSignupCredits: (userId) => grants(userId),
          logger,
          ...overrides,
        }),
      );
    },
  });
}

/** The token the gateway signs for a request with no session, and for a signed-in user. */
const signedOutToken = () => signInternalToken(privateKey, 'auth', {});
const userToken = (userId: string) => signInternalToken(privateKey, 'auth', { userId });

/** The Set-Cookie header for the session cookie, if the response has one. */
function sessionCookieHeader(response: Response): string | undefined {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((cookie) => cookie.startsWith('gilder_sid='));
}

function sessionIdIn(response: Response): string {
  const cookie = sessionCookieHeader(response);
  const id = cookie?.split(';')[0]?.slice('gilder_sid='.length);
  if (!id) {
    throw new Error('the response set no session cookie');
  }
  return id;
}

describe('POST /sessions (Google sign-in)', () => {
  it('starts a session, sets the cookie and returns the profile', async () => {
    const response = await request(buildApp())
      .post('/sessions')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ idToken: 'good-token' });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ email: 'nayan@example.com', name: 'Nayan' });
    const cookie = sessionCookieHeader(response) ?? '';
    expect(cookie).toMatch(/^gilder_sid=[A-Za-z0-9_-]{43};/);
    for (const part of ['Max-Age=2592000', 'Path=/', 'HttpOnly', 'SameSite=Lax']) {
      expect(cookie).toContain(part);
    }
    expect(cookie).not.toContain('Secure');
    await expect(resolveSession(store.redis, sessionIdIn(response))).resolves.toEqual({
      userId: response.body.user.id,
    });
    expect(grants).toHaveBeenCalledWith(response.body.user.id);
  });

  it('still signs in when billing is down, and asks for the grant again next time', async () => {
    grants.mockRejectedValueOnce(new AppError('service_unavailable', 'billing did not answer'));
    const sendSignIn = async () =>
      request(buildApp())
        .post('/sessions')
        .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
        .send({ idToken: 'good-token' });

    const first = await sendSignIn();
    const second = await sendSignIn();

    expect(first.status).toBe(200);
    expect(sessionCookieHeader(first)).toBeDefined();
    expect(second.status).toBe(200);
    expect(grants).toHaveBeenCalledTimes(2);
  });

  it('marks the cookie Secure when asked to', async () => {
    const response = await request(buildApp({ secureCookie: true }))
      .post('/sessions')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ idToken: 'good-token' });

    expect(sessionCookieHeader(response)).toContain('Secure');
  });

  it('answers 401 with no cookie when Firebase rejects the token', async () => {
    const response = await request(buildApp())
      .post('/sessions')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ idToken: 'forged' });

    expect(response.status).toBe(401);
    expect(sessionCookieHeader(response)).toBeUndefined();
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('answers 400 without a token, and 503 when Google sign-in is not set up', async () => {
    const missing = await request(buildApp())
      .post('/sessions')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({});
    const notSetUp = await request(buildApp({ verifyIdToken: googleSignInNotSetUp }))
      .post('/sessions')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ idToken: 'good-token' });

    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('validation_failed');
    expect(notSetUp.status).toBe(503);
  });

  it('answers 401 to a direct call without an internal token', async () => {
    const response = await request(buildApp()).post('/sessions').send({ idToken: 'good-token' });

    expect(response.status).toBe(401);
    expect(sessionCookieHeader(response)).toBeUndefined();
  });
});

describe('POST /sessions/dev (dev sign-in)', () => {
  it('starts a session for the email, making the user if needed', async () => {
    const response = await request(buildApp())
      .post('/sessions/dev')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ email: 'Dev@Example.com', name: 'Dev' });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ email: 'dev@example.com', name: 'Dev' });
    await expect(resolveSession(store.redis, sessionIdIn(response))).resolves.toEqual({
      userId: response.body.user.id,
    });
    expect(grants).toHaveBeenCalledWith(response.body.user.id);
  });

  it('does not exist when dev sign-in is off', async () => {
    const response = await request(buildApp({ devLogin: false }))
      .post('/sessions/dev')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ email: 'dev@example.com' });

    expect(response.status).toBe(404);
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('answers 400 for an address that is not an email', async () => {
    const response = await request(buildApp())
      .post('/sessions/dev')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /sessions/current (logout)', () => {
  async function signIn() {
    const response = await request(buildApp())
      .post('/sessions/dev')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .send({ email: 'dev@example.com' });
    return { userId: response.body.user.id as string, sessionId: sessionIdIn(response) };
  }

  it('ends the session and clears the cookie', async () => {
    const { userId, sessionId } = await signIn();

    const response = await request(buildApp())
      .delete('/sessions/current')
      .set(INTERNAL_TOKEN_HEADER, await userToken(userId))
      .set('Cookie', `gilder_sid=${sessionId}`);

    expect(response.status).toBe(204);
    expect(sessionCookieHeader(response)).toMatch(/^gilder_sid=;.*Expires=Thu, 01 Jan 1970/);
    await expect(resolveSession(store.redis, sessionId)).resolves.toBeUndefined();
  });

  it('is safe to call again, or without a cookie', async () => {
    const { userId, sessionId } = await signIn();
    const logout = async (cookie?: string) => {
      const call = request(buildApp())
        .delete('/sessions/current')
        .set(INTERNAL_TOKEN_HEADER, await userToken(userId));
      return (cookie ? call.set('Cookie', cookie) : call).then((response) => response.status);
    };

    expect(await logout(`gilder_sid=${sessionId}`)).toBe(204);
    expect(await logout(`gilder_sid=${sessionId}`)).toBe(204);
    expect(await logout()).toBe(204);
  });

  it('answers 401 when the internal token names no user', async () => {
    const { sessionId } = await signIn();

    const response = await request(buildApp())
      .delete('/sessions/current')
      .set(INTERNAL_TOKEN_HEADER, await signedOutToken())
      .set('Cookie', `gilder_sid=${sessionId}`);

    expect(response.status).toBe(401);
    await expect(resolveSession(store.redis, sessionId)).resolves.not.toBeUndefined();
  });
});

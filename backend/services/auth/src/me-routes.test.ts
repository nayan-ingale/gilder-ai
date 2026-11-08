import {
  createLogger,
  createService,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  signInternalToken,
} from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { meRouter } from './me-routes.ts';
import { UserModel } from './users.ts';

const logger = createLogger({ service: 'auth', level: 'silent' });
let mongo: TestMongo;
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

beforeEach(async () => {
  await UserModel.deleteMany({});
});

function buildApp() {
  return createService({
    name: 'auth',
    logger,
    internalAuth: { publicKey, audience: 'auth' },
    routes: (app) => {
      app.use(meRouter());
    },
  });
}

const tokenFor = (userId?: string) =>
  signInternalToken(privateKey, 'auth', userId ? { userId } : {});

async function makeUser(email = 'nayan@example.com') {
  return UserModel.create({ firebaseUid: `uid-${email}`, email, name: 'Nayan' });
}

describe('GET /me', () => {
  it("returns the signed-in user's profile", async () => {
    const user = await makeUser();

    const response = await request(buildApp())
      .get('/me')
      .set(INTERNAL_TOKEN_HEADER, await tokenFor(user.id));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: user.id,
        email: 'nayan@example.com',
        name: 'Nayan',
        avatarUrl: null,
        themePreference: 'system',
      },
    });
  });

  it('answers 401 without a user, and for a user that no longer exists', async () => {
    const user = await makeUser();
    await user.deleteOne();

    const signedOut = await request(buildApp())
      .get('/me')
      .set(INTERNAL_TOKEN_HEADER, await tokenFor());
    const gone = await request(buildApp())
      .get('/me')
      .set(INTERNAL_TOKEN_HEADER, await tokenFor(user.id));

    expect(signedOut.status).toBe(401);
    expect(gone.status).toBe(401);
    expect(gone.body.detail).toBe('This account no longer exists');
  });
});

describe('PATCH /me', () => {
  it('changes the theme and returns the updated profile', async () => {
    const user = await makeUser();

    const response = await request(buildApp())
      .patch('/me')
      .set(INTERNAL_TOKEN_HEADER, await tokenFor(user.id))
      .send({ themePreference: 'dark' });

    expect(response.status).toBe(200);
    expect(response.body.user.themePreference).toBe('dark');
    expect((await UserModel.findById(user.id))?.themePreference).toBe('dark');
  });

  it('answers 400 for an unknown theme or any other field', async () => {
    const user = await makeUser();
    const token = await tokenFor(user.id);

    for (const body of [
      { themePreference: 'neon' },
      { themePreference: 'dark', email: 'x@y.z' },
      {},
    ]) {
      const response = await request(buildApp())
        .patch('/me')
        .set(INTERNAL_TOKEN_HEADER, token)
        .send(body);

      expect(response.status).toBe(400);
    }
    expect((await UserModel.findById(user.id))?.toObject()).toMatchObject({
      email: 'nayan@example.com',
      themePreference: 'system',
    });
  });
});

describe('GET /internal/users/:id', () => {
  it('returns the user the token names', async () => {
    const user = await makeUser();

    const response = await request(buildApp())
      .get(`/internal/users/${user.id}`)
      .set(INTERNAL_TOKEN_HEADER, await tokenFor(user.id));

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(user.id);
  });

  it("answers 404 for another user's ID, just like an unknown one", async () => {
    const me = await makeUser('me@example.com');
    const other = await makeUser('other@example.com');
    const token = await tokenFor(me.id);

    const someoneElse = await request(buildApp())
      .get(`/internal/users/${other.id}`)
      .set(INTERNAL_TOKEN_HEADER, token);
    const unknown = await request(buildApp())
      .get('/internal/users/000000000000000000000000')
      .set(INTERNAL_TOKEN_HEADER, token);

    expect(someoneElse.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(someoneElse.body).toEqual({ ...unknown.body, requestId: someoneElse.body.requestId });
  });

  it('answers 400 for a malformed ID and 401 without a user', async () => {
    const user = await makeUser();

    const malformed = await request(buildApp())
      .get('/internal/users/not-an-id')
      .set(INTERNAL_TOKEN_HEADER, await tokenFor(user.id));
    const signedOut = await request(buildApp())
      .get(`/internal/users/${user.id}`)
      .set(INTERNAL_TOKEN_HEADER, await tokenFor());

    expect(malformed.status).toBe(400);
    expect(signedOut.status).toBe(401);
  });
});

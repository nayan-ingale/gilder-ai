import {
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  signInternalToken,
  SIGNUP_CREDITS,
} from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { grantSignupCredits } from './credits.ts';
import { AccountModel, LedgerModel, ReservationModel } from './models.ts';

let mongo: TestMongo;
let gatewayKey: InternalKey;
let gatewayPublicKey: InternalKey;
let authKey: InternalKey;
let authPublicKey: InternalKey;

beforeAll(async () => {
  mongo = await startTestMongo({ replicaSet: true });
  await Promise.all([AccountModel.init(), ReservationModel.init(), LedgerModel.init()]);
  const gateway = await generateInternalKeyPair();
  gatewayKey = await importInternalPrivateKey(gateway.privateKey);
  gatewayPublicKey = await importInternalPublicKey(gateway.publicKey);
  const auth = await generateInternalKeyPair();
  authKey = await importInternalPrivateKey(auth.privateKey);
  authPublicKey = await importInternalPublicKey(auth.publicKey);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    AccountModel.deleteMany({}),
    ReservationModel.deleteMany({}),
    LedgerModel.deleteMany({}),
  ]);
});

/** The invariant: balance = sum of ledger entries − credits on hold. */
async function expectBalanceMatchesLedger(userId: string) {
  const account = await AccountModel.findById(userId);
  const entries = await LedgerModel.find({ userId });
  const held = await ReservationModel.find({ userId, status: 'held' });
  const ledgerSum = entries.reduce((sum, entry) => sum + entry.delta, 0);
  const heldSum = held.reduce((sum, hold) => sum + hold.amount, 0);
  expect(account?.balance).toBe(ledgerSum - heldSum);
}

describe('grantSignupCredits', () => {
  it('gives a new user the sign-up credits once, with a ledger entry', async () => {
    const first = await grantSignupCredits('u1');
    const second = await grantSignupCredits('u1');

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
    expect(second.account.balance).toBe(SIGNUP_CREDITS);
    expect(await LedgerModel.countDocuments({ userId: 'u1', kind: 'signup_grant' })).toBe(1);
    await expectBalanceMatchesLedger('u1');
  });

  it('grants once even when many sign-ins race', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => grantSignupCredits('u1')));

    expect(results.filter((result) => result.granted)).toHaveLength(1);
    expect((await AccountModel.findById('u1'))?.balance).toBe(SIGNUP_CREDITS);
    await expectBalanceMatchesLedger('u1');
  });
});

describe('POST /internal/accounts', () => {
  const app = () =>
    createApp({
      logger: createLogger({ service: 'billing', level: 'silent' }),
      internalPublicKey: gatewayPublicKey,
      callerKeys: { auth: authPublicKey },
    });

  it('grants for the user in the token when auth calls, 201 then 200', async () => {
    const token = await signInternalToken(authKey, 'billing', { userId: 'u1' }, 60, 'auth');

    const first = await request(app()).post('/internal/accounts').set(INTERNAL_TOKEN_HEADER, token);
    const again = await request(app()).post('/internal/accounts').set(INTERNAL_TOKEN_HEADER, token);

    expect(first.status).toBe(201);
    expect(first.body).toEqual({
      account: { plan: 'free', planExpiresAt: null, balance: SIGNUP_CREDITS },
      granted: true,
    });
    expect(again.status).toBe(200);
    expect(again.body.granted).toBe(false);
  });

  it('refuses the gateway, a token without a user, and keys it does not trust', async () => {
    const otherKey = await importInternalPrivateKey((await generateInternalKeyPair()).privateKey);
    const cases = [
      [await signInternalToken(gatewayKey, 'billing', { userId: 'u1' }), 403],
      [await signInternalToken(authKey, 'billing', {}, 60, 'auth'), 401],
      [await signInternalToken(otherKey, 'billing', { userId: 'u1' }, 60, 'auth'), 401],
      [await signInternalToken(authKey, 'billing', { userId: 'u1' }, 60, 'agent'), 401],
    ] as const;

    for (const [token, status] of cases) {
      const response = await request(app())
        .post('/internal/accounts')
        .set(INTERNAL_TOKEN_HEADER, token);
      expect(response.status).toBe(status);
    }
    expect(await AccountModel.countDocuments()).toBe(0);
  });
});

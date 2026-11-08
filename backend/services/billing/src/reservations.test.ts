import {
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  mongoose,
  signInternalToken,
} from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { commitCredits, grantSignupCredits, releaseCredits, reserveCredits } from './credits.ts';
import { AccountModel, LedgerModel, ReservationModel } from './models.ts';

let mongo: TestMongo;
let gatewayPublicKey: InternalKey;
let agentKey: InternalKey;
let agentPublicKey: InternalKey;
let authKey: InternalKey;
let authPublicKey: InternalKey;

beforeAll(async () => {
  mongo = await startTestMongo({ replicaSet: true });
  await Promise.all([AccountModel.init(), ReservationModel.init(), LedgerModel.init()]);
  gatewayPublicKey = await importInternalPublicKey((await generateInternalKeyPair()).publicKey);
  const agent = await generateInternalKeyPair();
  agentKey = await importInternalPrivateKey(agent.privateKey);
  agentPublicKey = await importInternalPublicKey(agent.publicKey);
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
async function expectInvariant(userId: string) {
  const [account, entries, held] = await Promise.all([
    AccountModel.findById(userId),
    LedgerModel.find({ userId }),
    ReservationModel.find({ userId, status: 'held' }),
  ]);
  const ledgerSum = entries.reduce((sum, entry) => sum + entry.delta, 0);
  const heldSum = held.reduce((sum, hold) => sum + hold.amount, 0);
  expect(account?.balance).toBe(ledgerSum - heldSum);
  expect(account?.balance).toBeGreaterThanOrEqual(0);
}

const reserve = (userId: string, key: string, agent: 'chat' | 'search' | 'code' = 'chat') =>
  reserveCredits({ userId, agent, idempotencyKey: key });

describe('reserve, commit and release', () => {
  it('holds the cost, then charges it on commit, keeping the ledger in step', async () => {
    await grantSignupCredits('u1');

    const held = await reserve('u1', 'turn-0001', 'search');
    expect(held).toMatchObject({ created: true, balance: 95 });
    await expectInvariant('u1');

    const committed = await commitCredits('u1', held.reservation.id, {
      model: 'test-model',
      inputTokens: 12,
      outputTokens: 34,
    });
    expect(committed.balance).toBe(95);
    expect(committed.reservation.status).toBe('committed');
    const usage = await LedgerModel.findOne({ userId: 'u1', kind: 'usage' });
    expect(usage).toMatchObject({ delta: -5 });
    expect(usage?.metadata).toMatchObject({
      agent: 'search',
      model: 'test-model',
      outputTokens: 34,
    });
    await expectInvariant('u1');
  });

  it('gives the credits back on release, with no ledger entry', async () => {
    await grantSignupCredits('u1');
    const held = await reserve('u1', 'turn-0001', 'code');

    const released = await releaseCredits('u1', held.reservation.id);

    expect(released.balance).toBe(100);
    expect(await LedgerModel.countDocuments({ userId: 'u1', kind: 'usage' })).toBe(0);
    await expectInvariant('u1');
  });

  it('refuses with 402 when the balance is too low, changing nothing', async () => {
    await AccountModel.create({ _id: 'u1', balance: 4 });

    await expect(reserve('u1', 'turn-0001', 'search')).rejects.toMatchObject({
      code: 'insufficient_credits',
      status: 402,
    });
    await expect(reserve('nobody', 'turn-0002')).rejects.toMatchObject({ status: 402 });
    expect((await AccountModel.findById('u1'))?.balance).toBe(4);
    expect(await ReservationModel.countDocuments()).toBe(0);
  });

  it('holds once per idempotency key, even when the same reserve races', async () => {
    await grantSignupCredits('u1');

    const results = await Promise.all(
      Array.from({ length: 5 }, () => reserve('u1', 'turn-0001', 'code')),
    );

    expect(new Set(results.map((result) => result.reservation.id)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect((await AccountModel.findById('u1'))?.balance).toBe(90);
    await expect(reserve('u2', 'turn-0001')).rejects.toMatchObject({ code: 'conflict' });
    await expectInvariant('u1');
  });

  it('treats a repeat as a no-op, the opposite outcome as a conflict, and others as not found', async () => {
    await grantSignupCredits('u1');
    const committed = await reserve('u1', 'turn-0001');
    const released = await reserve('u1', 'turn-0002');
    await commitCredits('u1', committed.reservation.id);
    await releaseCredits('u1', released.reservation.id);

    await expect(commitCredits('u1', committed.reservation.id)).resolves.toMatchObject({
      balance: 99,
    });
    await expect(releaseCredits('u1', released.reservation.id)).resolves.toMatchObject({
      balance: 99,
    });
    await expect(releaseCredits('u1', committed.reservation.id)).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(commitCredits('u1', released.reservation.id)).rejects.toMatchObject({
      code: 'conflict',
    });
    for (const [userId, id] of [
      ['u2', committed.reservation.id],
      ['u1', new mongoose.Types.ObjectId().toString()],
      ['u1', 'not-an-id'],
    ] as const) {
      await expect(commitCredits(userId, id)).rejects.toMatchObject({ code: 'not_found' });
    }
    expect(await LedgerModel.countDocuments({ kind: 'usage' })).toBe(1);
    await expectInvariant('u1');
  });

  it('never overdraws: 50 parallel reservations against 100 credits (SEC-08)', async () => {
    await grantSignupCredits('u1');

    const outcomes = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) => reserve('u1', `parallel-${index}`, 'code')),
    );

    const held = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const refused = outcomes.filter(
      (outcome) => outcome.status === 'rejected' && outcome.reason?.code === 'insufficient_credits',
    );
    expect(held).toHaveLength(10);
    expect(refused).toHaveLength(40);
    expect((await AccountModel.findById('u1'))?.balance).toBe(0);
    await expectInvariant('u1');
  }, 60_000);
});

describe('credit routes', () => {
  const app = () =>
    createApp({
      logger: createLogger({ service: 'billing', level: 'silent' }),
      internalPublicKey: gatewayPublicKey,
      callerKeys: { auth: authPublicKey, agent: agentPublicKey },
    });
  const asAgent = (userId: string) =>
    signInternalToken(agentKey, 'billing', { userId }, 60, 'agent');

  it('lets the agent reserve, commit and release for the user in the token', async () => {
    await grantSignupCredits('u1');
    const token = await asAgent('u1');

    const reserved = await request(app())
      .post('/internal/credits/reserve')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({ agent: 'search', idempotencyKey: 'turn-0001' });
    const again = await request(app())
      .post('/internal/credits/reserve')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({ agent: 'search', idempotencyKey: 'turn-0001' });
    const committed = await request(app())
      .post('/internal/credits/commit')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({
        reservationId: reserved.body.reservation.id,
        metadata: { model: 'm', latencyMs: 900 },
      });

    expect(reserved.status).toBe(201);
    expect(reserved.body).toMatchObject({
      reservation: { amount: 5, agent: 'search', status: 'held' },
      balance: 95,
    });
    expect(again.status).toBe(200);
    expect(again.body.reservation.id).toBe(reserved.body.reservation.id);
    expect(committed.body).toMatchObject({ reservation: { status: 'committed' }, balance: 95 });

    const second = await request(app())
      .post('/internal/credits/reserve')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({ agent: 'chat', idempotencyKey: 'turn-0002' });
    const released = await request(app())
      .post('/internal/credits/release')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({ reservationId: second.body.reservation.id });
    expect(released.body).toMatchObject({ reservation: { status: 'released' }, balance: 95 });
  });

  it('answers 402 as problem+json when the user is out of credits', async () => {
    await AccountModel.create({ _id: 'u1', balance: 0 });

    const response = await request(app())
      .post('/internal/credits/reserve')
      .set(INTERNAL_TOKEN_HEADER, await asAgent('u1'))
      .send({ agent: 'chat', idempotencyKey: 'turn-0001' });

    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({ code: 'insufficient_credits' });
  });

  it('refuses other callers and malformed requests', async () => {
    await grantSignupCredits('u1');
    const fromAuth = await signInternalToken(authKey, 'billing', { userId: 'u1' }, 60, 'auth');

    const wrongCaller = await request(app())
      .post('/internal/credits/reserve')
      .set(INTERNAL_TOKEN_HEADER, fromAuth)
      .send({ agent: 'chat', idempotencyKey: 'turn-0001' });
    expect(wrongCaller.status).toBe(403);

    for (const body of [
      { agent: 'robot', idempotencyKey: 'turn-0001' },
      { agent: 'chat', idempotencyKey: 'short' },
      { agent: 'chat', idempotencyKey: 'turn-0001', amount: 0 },
    ]) {
      const response = await request(app())
        .post('/internal/credits/reserve')
        .set(INTERNAL_TOKEN_HEADER, await asAgent('u1'))
        .send(body);
      expect(response.status).toBe(400);
    }
    expect((await AccountModel.findById('u1'))?.balance).toBe(100);
  });
});

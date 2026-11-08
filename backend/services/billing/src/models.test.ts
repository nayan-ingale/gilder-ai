import { mongoose } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountModel, LedgerModel, ReservationModel, toAccount } from './models.ts';

let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo({ replicaSet: true });
  await Promise.all([AccountModel.init(), ReservationModel.init(), LedgerModel.init()]);
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

describe('AccountModel', () => {
  it('starts on the free plan with no credits, keyed by the user ID', async () => {
    const account = await AccountModel.create({ _id: 'u1' });

    expect(toAccount(account)).toEqual({ plan: 'free', planExpiresAt: null, balance: 0 });
  });

  it('refuses a negative or fractional balance and unknown plans', async () => {
    for (const bad of [{ balance: -1 }, { balance: 1.5 }, { plan: 'gold' }]) {
      // Untyped on purpose: these values come from outside the type system.
      await expect(
        AccountModel.create({ _id: 'u1', ...bad } as Record<string, unknown>),
      ).rejects.toThrow(mongoose.Error.ValidationError);
    }
  });
});

describe('ReservationModel', () => {
  it('holds once per idempotency key', async () => {
    const hold = { userId: 'u1', amount: 1, agent: 'chat', idempotencyKey: 'turn-1' } as const;
    await ReservationModel.create(hold);

    await expect(ReservationModel.create(hold)).rejects.toMatchObject({ code: 11000 });
  });
});

describe('LedgerModel', () => {
  it('keeps one sign-up grant per user and one usage entry per reservation', async () => {
    await LedgerModel.create({ userId: 'u1', delta: 100, kind: 'signup_grant' });
    await expect(
      LedgerModel.create({ userId: 'u1', delta: 100, kind: 'signup_grant' }),
    ).rejects.toMatchObject({ code: 11000 });

    const reservationId = new mongoose.Types.ObjectId();
    await LedgerModel.create({ userId: 'u1', delta: -1, kind: 'usage', reservationId });
    await expect(
      LedgerModel.create({ userId: 'u1', delta: -1, kind: 'usage', reservationId }),
    ).rejects.toMatchObject({ code: 11000 });

    // Purchases and adjustments are not limited by those indexes.
    await LedgerModel.create([
      { userId: 'u1', delta: 500, kind: 'purchase', paymentId: 'pay_1' },
      { userId: 'u1', delta: 500, kind: 'purchase', paymentId: 'pay_2' },
    ]);
    expect(await LedgerModel.countDocuments({ userId: 'u1' })).toBe(4);
  });

  it('refuses a zero or fractional change', async () => {
    for (const delta of [0, 0.5]) {
      await expect(LedgerModel.create({ userId: 'u1', delta, kind: 'adjustment' })).rejects.toThrow(
        mongoose.Error.ValidationError,
      );
    }
  });

  it('runs inside a transaction on the test replica set', async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await AccountModel.create([{ _id: 'u1', balance: 5 }], { session });
        await LedgerModel.create([{ userId: 'u1', delta: 5, kind: 'adjustment' }], { session });
      });
    } finally {
      await session.endSession();
    }

    expect((await AccountModel.findById('u1'))?.balance).toBe(5);
  });
});

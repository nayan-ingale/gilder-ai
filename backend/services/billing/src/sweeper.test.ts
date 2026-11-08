import { createLogger } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { commitCredits, grantSignupCredits, reserveCredits } from './credits.ts';
import { AccountModel, LedgerModel, ReservationModel } from './models.ts';
import { releaseStaleReservations, startReservationSweeper } from './sweeper.ts';

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

const MINUTE = 60_000;

/** A held reservation, back-dated so it looks `minutesOld` minutes old. */
async function holdFrom(minutesOld: number, key: string) {
  const { reservation } = await reserveCredits({
    userId: 'u1',
    agent: 'code',
    idempotencyKey: key,
  });
  await ReservationModel.collection.updateOne(
    { _id: reservation._id },
    { $set: { createdAt: new Date(Date.now() - minutesOld * MINUTE) } },
  );
  return reservation;
}

describe('releaseStaleReservations', () => {
  it('gives back only holds older than ten minutes, leaving recent and finished ones', async () => {
    await grantSignupCredits('u1');
    const stale = await holdFrom(11, 'stale-0001');
    const recent = await holdFrom(2, 'recent-0001');
    const done = await holdFrom(30, 'done-00001');
    await commitCredits('u1', done.id);

    const released = await releaseStaleReservations();

    expect(released).toBe(1);
    const statuses = await ReservationModel.find().sort({ createdAt: 1 });
    expect(Object.fromEntries(statuses.map((r) => [r.id, r.status]))).toEqual({
      [done.id]: 'committed',
      [stale.id]: 'released',
      [recent.id]: 'held',
    });
    // 100 − 10 committed − 10 still held for the recent answer.
    expect((await AccountModel.findById('u1'))?.balance).toBe(80);
  });

  it('releases each hold once when several sweeps run at the same time', async () => {
    await grantSignupCredits('u1');
    for (let index = 0; index < 5; index += 1) {
      await holdFrom(20, `stale-000${index}`);
    }

    const counts = await Promise.all([
      releaseStaleReservations(),
      releaseStaleReservations(),
      releaseStaleReservations(),
    ]);

    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(5);
    expect((await AccountModel.findById('u1'))?.balance).toBe(100);
  });
});

describe('startReservationSweeper', () => {
  it('sweeps on its interval until stopped', async () => {
    await grantSignupCredits('u1');
    await holdFrom(20, 'stale-0001');

    const stop = startReservationSweeper({
      logger: createLogger({ service: 'billing', level: 'silent' }),
      intervalMs: 20,
    });
    try {
      await expect
        .poll(async () => (await AccountModel.findById('u1'))?.balance, { timeout: 2_000 })
        .toBe(100);
    } finally {
      stop();
    }
  });
});

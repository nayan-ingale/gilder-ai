import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from './logger.ts';
import { connectMongo, disconnectMongo, pingMongo } from './mongo.ts';

// A real MongoDB (in memory) running as a replica set, like the local Docker one,
// because the credits ledger depends on multi-document transactions.
let replSet: MongoMemoryReplSet;

const Account = mongoose.model('TestAccount', new mongoose.Schema({ balance: Number }));
const Ledger = mongoose.model('TestLedger', new mongoose.Schema({ delta: Number }));

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectMongo(
    replSet.getUri('gilder_test'),
    createLogger({ service: 'test', level: 'silent' }),
  );
}, 120_000);

afterAll(async () => {
  await disconnectMongo();
  await replSet.stop();
});

describe('mongo', () => {
  it('answers the readiness ping once connected', async () => {
    await expect(pingMongo()).resolves.toBeUndefined();
  });

  it('commits a multi-document transaction', async () => {
    const account = await Account.create({ balance: 10 });

    await mongoose.connection.transaction(async (session) => {
      await Account.updateOne(
        { _id: account._id, balance: { $gte: 5 } },
        { $inc: { balance: -5 } },
        { session },
      );
      await Ledger.create([{ delta: -5 }], { session });
    });

    expect((await Account.findById(account._id))?.balance).toBe(5);
    expect(await Ledger.countDocuments()).toBe(1);
  });

  it('rolls back every write when the transaction fails', async () => {
    const account = await Account.create({ balance: 10 });
    const ledgerBefore = await Ledger.countDocuments();

    await expect(
      mongoose.connection.transaction(async (session) => {
        await Account.updateOne({ _id: account._id }, { $inc: { balance: -5 } }, { session });
        await Ledger.create([{ delta: -5 }], { session });
        throw new Error('payment provider timed out');
      }),
    ).rejects.toThrow('payment provider timed out');

    expect((await Account.findById(account._id))?.balance).toBe(10);
    expect(await Ledger.countDocuments()).toBe(ledgerBefore);
  });
});

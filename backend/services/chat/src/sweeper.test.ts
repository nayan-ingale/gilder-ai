import { createLogger, mongoose } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type MESSAGE_STATUSES, MessageModel } from './models.ts';
import { failStaleAnswers, startStaleAnswerSweeper } from './sweeper.ts';

let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo();
  await MessageModel.init();
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await MessageModel.deleteMany({});
});

const MINUTE = 60_000;
const chatId = new mongoose.Types.ObjectId();

/** An answer in `status`, back-dated so it was last written `minutesOld` minutes ago. */
async function answerFrom(minutesOld: number, status: (typeof MESSAGE_STATUSES)[number]) {
  const message = await MessageModel.create({
    conversationId: chatId,
    userId: 'u1',
    role: 'assistant',
    agent: 'code',
    status,
  });
  await MessageModel.collection.updateOne(
    { _id: message._id },
    { $set: { updatedAt: new Date(Date.now() - minutesOld * MINUTE) } },
  );
  return message.id;
}

async function statuses() {
  const messages = await MessageModel.find();
  return Object.fromEntries(messages.map((message) => [message.id, message.status]));
}

describe('failStaleAnswers', () => {
  it('fails only answers left streaming for over ten minutes', async () => {
    const stale = await answerFrom(11, 'streaming');
    const writing = await answerFrom(2, 'streaming');
    const done = await answerFrom(30, 'complete');
    const stopped = await answerFrom(30, 'stopped');

    expect(await failStaleAnswers()).toBe(1);

    expect(await statuses()).toEqual({
      [stale]: 'failed',
      [writing]: 'streaming',
      [done]: 'complete',
      [stopped]: 'stopped',
    });
  });

  it('marks each answer once when several sweeps run at the same time', async () => {
    for (let index = 0; index < 5; index += 1) {
      await answerFrom(20, 'streaming');
    }

    const counts = await Promise.all([failStaleAnswers(), failStaleAnswers(), failStaleAnswers()]);

    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(5);
    expect(Object.values(await statuses())).toEqual(Array(5).fill('failed'));
  });
});

describe('startStaleAnswerSweeper', () => {
  it('sweeps on its interval until stopped', async () => {
    const stale = await answerFrom(20, 'streaming');

    const stop = startStaleAnswerSweeper({
      logger: createLogger({ service: 'chat', level: 'silent' }),
      intervalMs: 20,
    });
    try {
      await expect.poll(async () => (await statuses())[stale], { timeout: 2_000 }).toBe('failed');
    } finally {
      stop();
    }
  });
});

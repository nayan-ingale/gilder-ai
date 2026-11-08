import { createLogger, runWithContext } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LlmCallModel, llmCallRecorder } from './telemetry.ts';

let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo();
  await LlmCallModel.init();
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

describe('llmCallRecorder', () => {
  it("saves the attempt with the request's user and ID", async () => {
    const record = llmCallRecorder(createLogger({ service: 'agent', level: 'silent' }));

    runWithContext({ requestId: 'req-1', userId: 'u1' }, () =>
      record({
        purpose: 'chat',
        agent: 'chat',
        messageId: 'm1',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        tokensIn: 80,
        tokensOut: 51,
        ttftMs: 300,
        latencyMs: 900,
        status: 'ok',
      }),
    );

    await expect
      .poll(async () => LlmCallModel.findOne({ requestId: 'req-1' }).lean())
      .toMatchObject({
        userId: 'u1',
        messageId: 'm1',
        provider: 'groq',
        tokensOut: 51,
        ttftMs: 300,
        status: 'ok',
      });
  });
});

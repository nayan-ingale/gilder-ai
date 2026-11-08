import { createLogger } from '@gilder/shared';
import { createTestRedis, type TestRedis } from '@gilder/shared/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStopSignals, type StopSignals } from './stops.ts';

const logger = createLogger({ service: 'agent', level: 'silent' });
let store: TestRedis;
let instanceA: StopSignals;
let instanceB: StopSignals;

beforeEach(async () => {
  store = await createTestRedis();
  // Two agent instances sharing one Redis, as when the agent runs more than once.
  instanceA = await createStopSignals(store.redis, logger);
  instanceB = await createStopSignals(store.redis, logger);
});

afterEach(async () => {
  await instanceA.close();
  await instanceB.close();
  await store.cleanup();
});

describe('stop signals', () => {
  it('stops an answer running on another instance, for its owner only', async () => {
    const controller = new AbortController();
    const unregister = await instanceA.register('turn-1', 'u1', controller);

    expect(await instanceB.stop('turn-1', 'u2')).toBe(false);
    expect(controller.signal.aborted).toBe(false);

    expect(await instanceB.stop('turn-1', 'u1')).toBe(true);
    await expect.poll(() => controller.signal.aborted).toBe(true);
    await unregister();
  });

  it('forgets a finished answer', async () => {
    const unregister = await instanceA.register('turn-1', 'u1', new AbortController());
    await unregister();

    expect(await instanceB.stop('turn-1', 'u1')).toBe(false);
    expect(await store.redis.exists('turn:turn-1')).toBe(0);
  });
});

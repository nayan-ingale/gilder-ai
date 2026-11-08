import { createTestRedis, type TestRedis } from '@gilder/shared/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemory, type MemoryMessage, trimToBudget } from './memory.ts';

let store: TestRedis;

beforeEach(async () => {
  store = await createTestRedis();
});

afterEach(async () => {
  await store.cleanup();
});

const turn = (index: number): MemoryMessage[] => [
  { role: 'user', content: `question ${index}` },
  { role: 'assistant', content: `answer ${index}` },
];

describe('memory', () => {
  it('reads the chat service once, then serves from the cache', async () => {
    const fetchRecent = vi.fn(async () => [...turn(1), ...turn(2)]);
    const memory = createMemory(store.redis, fetchRecent);

    const first = await memory.load('chat-1', 'u1');
    const second = await memory.load('chat-1', 'u1');

    expect(first).toEqual([...turn(1), ...turn(2)]);
    expect(second).toEqual(first);
    expect(fetchRecent).toHaveBeenCalledOnce();
    expect(fetchRecent).toHaveBeenCalledWith('chat-1', 'u1');
    expect(await store.redis.ttl('mem:chat-1')).toBeGreaterThan(3_000);
  });

  it('appends new turns to the cache, keeping the last 20 messages', async () => {
    const memory = createMemory(store.redis, async () => turn(0));
    await memory.load('chat-1', 'u1');

    for (let index = 1; index <= 12; index += 1) {
      await memory.append('chat-1', turn(index));
    }

    const loaded = await memory.load('chat-1', 'u1');
    expect(loaded).toHaveLength(20);
    expect(loaded[0]).toEqual({ role: 'user', content: 'question 3' });
    expect(loaded.at(-1)).toEqual({ role: 'assistant', content: 'answer 12' });
  });

  it('does not create a cache on append, and drops it on forget', async () => {
    const fetchRecent = vi.fn(async () => turn(1));
    const memory = createMemory(store.redis, fetchRecent);

    await memory.append('chat-1', turn(2));
    expect(await store.redis.exists('mem:chat-1')).toBe(0);

    await memory.load('chat-1', 'u1');
    await memory.forget('chat-1');
    await memory.load('chat-1', 'u1');
    expect(fetchRecent).toHaveBeenCalledTimes(2);
  });
});

describe('trimToBudget', () => {
  it('keeps the newest messages that fit, in order', () => {
    const messages: MemoryMessage[] = [
      { role: 'user', content: 'a'.repeat(50) },
      { role: 'assistant', content: 'b'.repeat(30) },
      { role: 'user', content: 'c'.repeat(30) },
    ];

    expect(trimToBudget(messages, 70).map((message) => message.content[0])).toEqual(['b', 'c']);
    expect(trimToBudget(messages, 10)).toEqual([]);
  });
});

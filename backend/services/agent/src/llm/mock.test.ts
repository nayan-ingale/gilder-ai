import { describe, expect, it } from 'vitest';
import { createMockProvider } from './mock.ts';
import type { StreamEvent } from './types.ts';

async function collect(stream: AsyncIterable<StreamEvent>) {
  const events: StreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe('createMockProvider', () => {
  it('streams a canned answer word by word, then usage', async () => {
    const mock = createMockProvider({ delayMs: 0 });

    const events = await collect(
      mock.stream({ model: 'mock', messages: [{ role: 'user', content: 'Plan a trip' }] }),
    );

    const text = events.flatMap((event) => (event.type === 'token' ? [event.text] : [])).join('');
    expect(text).toContain('This is a mock answer to: "Plan a trip".');
    expect(events.filter((event) => event.type === 'token').length).toBeGreaterThan(5);
    expect(events.at(-1)).toMatchObject({ type: 'usage' });
  });

  it('answers JSON requests with a route to chat, or with a custom responder', async () => {
    const json = await collect(
      createMockProvider({ delayMs: 0 }).stream({ model: 'mock', messages: [], json: true }),
    );
    const custom = await collect(
      createMockProvider({ delayMs: 0, respond: () => 'fixed reply' }).stream({
        model: 'mock',
        messages: [],
      }),
    );

    const textOf = (events: StreamEvent[]) =>
      events.flatMap((event) => (event.type === 'token' ? [event.text] : [])).join('');
    expect(JSON.parse(textOf(json))).toEqual({ agent: 'chat', confidence: 0.9 });
    expect(textOf(custom)).toBe('fixed reply');
  });

  it('stops when the caller aborts', async () => {
    const controller = new AbortController();
    const seen: string[] = [];

    await expect(
      (async () => {
        for await (const event of createMockProvider({ delayMs: 0 }).stream({
          model: 'mock',
          messages: [{ role: 'user', content: 'go' }],
          signal: controller.signal,
        })) {
          if (event.type === 'token') {
            seen.push(event.text);
            controller.abort();
          }
        }
      })(),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen).toHaveLength(1);
  });
});

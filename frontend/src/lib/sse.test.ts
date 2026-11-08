import { describe, expect, it } from 'vitest';
import { readServerEvents } from './sse';

function bodyOf(pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) {
        controller.enqueue(encoder.encode(piece));
      }
      controller.close();
    },
  });
}

describe('readServerEvents', () => {
  it('yields named JSON events, across split chunks, skipping heartbeats', async () => {
    const events = [];
    for await (const event of readServerEvents(
      bodyOf([': ping\n\nevent: tok', 'en\ndata: {"text":"Hi"}\n\n', 'event: done\ndata: {}\n\n']),
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { event: 'token', data: { text: 'Hi' } },
      { event: 'done', data: {} },
    ]);
  });
});

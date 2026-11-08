import { describe, expect, it, vi } from 'vitest';
import { readSseData } from './sse.ts';

/** A body that delivers the given pieces one read at a time. */
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

async function collect(body: ReadableStream<Uint8Array>) {
  const out: string[] = [];
  for await (const data of readSseData(body, { idleMs: 1_000, onIdle: () => {} })) {
    out.push(data);
  }
  return out;
}

describe('readSseData', () => {
  it('yields each event, even when events are split across reads', async () => {
    const events = await collect(
      bodyOf(['data: {"a":', '1}\n\ndata: {"b":2}\n', '\ndata: [DONE]\n\n']),
    );

    expect(events).toEqual(['{"a":1}', '{"b":2}', '[DONE]']);
  });

  it('handles CRLF line ends, comments and multi-line data', async () => {
    const events = await collect(bodyOf([': keep-alive\r\n\r\ndata: one\r\ndata: two\r\n\r\n']));

    expect(events).toEqual(['one\ntwo']);
  });

  it('calls onIdle when no bytes arrive for too long', async () => {
    const onIdle = vi.fn();
    const stalled = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: first\n\n'));
      },
    });
    const events = readSseData(stalled, { idleMs: 20, onIdle });

    expect((await events.next()).value).toBe('first');
    await vi.waitFor(() => expect(onIdle).toHaveBeenCalledOnce());
    await events.return(undefined);
  });
});

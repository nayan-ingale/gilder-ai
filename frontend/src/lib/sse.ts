/** One server-sent event: its name and its JSON data. */
export interface ServerEvent {
  event: string;
  data: unknown;
}

/**
 * Reads a server-sent events body as it arrives, yielding each named event. Comments (the
 * server's heartbeat) are skipped. Data that isn't JSON is passed on as text.
 */
export async function* readServerEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<ServerEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // A stop ends the read at once, even where the network layer would keep the body open.
  const cancel = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
        const parsed = parseBlock(block);
        if (parsed) {
          yield parsed;
        }
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function parseBlock(block: string): ServerEvent | undefined {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).replace(/^ /, ''));
    }
  }
  if (data.length === 0) {
    return undefined;
  }
  const text = data.join('\n');
  try {
    return { event, data: JSON.parse(text) as unknown };
  } catch {
    return { event, data: text };
  }
}

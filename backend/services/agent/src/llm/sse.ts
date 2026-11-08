/**
 * Reads a server-sent events body and yields each event's data, one string per event. It also
 * enforces an idle limit: if no bytes arrive for `idleMs`, `onIdle` runs (it aborts the call).
 */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
  options: { idleMs: number; onIdle: () => void },
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let timer = setTimeout(options.onIdle, options.idleMs);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      clearTimeout(timer);
      if (done) {
        break;
      }
      timer = setTimeout(options.onIdle, options.idleMs);
      buffer += decoder.decode(value, { stream: true });
      // Events end with a blank line; lines may end in \n or \r\n.
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data !== '') {
          yield data;
        }
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

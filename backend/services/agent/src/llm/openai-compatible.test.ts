import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createOpenAiCompatibleProvider } from './openai-compatible.ts';
import { LlmError, type StreamEvent, type StreamRequest } from './types.ts';

let server: Server | undefined;
let received: { headers: IncomingMessage['headers']; body: Record<string, unknown> }[] = [];

afterEach(async () => {
  received = [];
  if (server) {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
    server = undefined;
  }
});

/** A stand-in provider on a local port. */
async function provider(
  handle: (res: ServerResponse) => void,
  timeouts: { startTimeoutMs?: number; idleTimeoutMs?: number } = {},
) {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      received.push({ headers: req.headers, body: JSON.parse(raw) as Record<string, unknown> });
      handle(res);
    });
  });
  server.listen(0);
  await once(server, 'listening');
  return createOpenAiCompatibleProvider({
    name: 'groq',
    baseUrl: `http://localhost:${(server.address() as AddressInfo).port}/v1/`,
    apiKey: 'test-key',
    ...timeouts,
  });
}

const sse = (res: ServerResponse, chunks: unknown[], end = true) => {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const chunk of chunks) {
    res.write(`data: ${typeof chunk === 'string' ? chunk : JSON.stringify(chunk)}\n\n`);
  }
  if (end) {
    res.end();
  }
};

const request: StreamRequest = {
  model: 'openai/gpt-oss-20b',
  messages: [{ role: 'user', content: 'hi' }],
};

async function collect(stream: AsyncIterable<StreamEvent>) {
  const events: StreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe('createOpenAiCompatibleProvider', () => {
  it('streams the answer tokens and usage, skipping the reasoning', async () => {
    const llm = await provider((res) =>
      sse(res, [
        { choices: [{ delta: { role: 'assistant', content: '' } }] },
        { choices: [{ delta: { reasoning: 'Thinking…' } }] },
        { choices: [{ delta: { content: 'Hello' } }] },
        {
          choices: [{ delta: { content: ' there' } }],
          usage: { prompt_tokens: 12, completion_tokens: 2 },
        },
        { choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } },
        '[DONE]',
      ]),
    );

    const events = await collect(
      llm.stream({ ...request, json: true, maxTokens: 50, reasoningEffort: 'low' }),
    );

    expect(events).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ' there' },
      { type: 'usage', inputTokens: 12, outputTokens: 3 },
    ]);
    expect(received[0]?.headers.authorization).toBe('Bearer test-key');
    expect(received[0]?.body).toMatchObject({
      model: 'openai/gpt-oss-20b',
      stream: true,
      stream_options: { include_usage: true },
      response_format: { type: 'json_object' },
      max_completion_tokens: 50,
      reasoning_effort: 'low',
    });
  });

  it('marks rate limits and server errors retryable, and bad requests not', async () => {
    for (const [status, retryable] of [
      [429, true],
      [503, true],
      [400, false],
      [401, false],
    ] as const) {
      const llm = await provider((res) => {
        res.writeHead(status).end('{"error":"nope"}');
      });
      const failure = await collect(llm.stream(request)).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(LlmError);
      expect(failure).toMatchObject({ retryable, status, provider: 'groq' });
      server?.closeAllConnections();
      server?.close();
      server = undefined;
    }
  });

  it('gives up when the provider is slow to start or goes silent mid-answer', async () => {
    const slow = await provider(() => {}, { startTimeoutMs: 50 });
    await expect(collect(slow.stream(request))).rejects.toMatchObject({
      message: 'groq did not start answering in time',
      retryable: true,
    });
    server?.closeAllConnections();
    server?.close();
    server = undefined;

    const stalled = await provider(
      (res) => sse(res, [{ choices: [{ delta: { content: 'Half' } }] }], false),
      { idleTimeoutMs: 50 },
    );
    const events: StreamEvent[] = [];
    await expect(
      (async () => {
        for await (const event of stalled.stream(request)) {
          events.push(event);
        }
      })(),
    ).rejects.toMatchObject({ message: 'groq went silent mid-answer' });
    expect(events).toEqual([{ type: 'token', text: 'Half' }]);
  });

  it("passes the caller's abort through as an abort, not a provider failure", async () => {
    const llm = await provider((res) =>
      sse(res, [{ choices: [{ delta: { content: 'Start' } }] }], false),
    );
    const controller = new AbortController();

    const run = (async () => {
      for await (const event of llm.stream({ ...request, signal: controller.signal })) {
        if (event.type === 'token') {
          controller.abort();
        }
      }
    })();

    const failure = await run.catch((error: unknown) => error);
    expect(failure).not.toBeInstanceOf(LlmError);
    expect((failure as Error).name).toBe('AbortError');
  });
});

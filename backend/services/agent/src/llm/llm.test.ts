import { createLogger } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { createLlm } from './llm.ts';
import { createMockProvider } from './mock.ts';
import { LlmError, type LlmProvider, type ProviderName, type StreamEvent } from './types.ts';

const logger = createLogger({ service: 'agent', level: 'silent' });

/** A provider that plays back `script`: tokens, then optionally an error. */
function scripted(
  name: ProviderName,
  script: (string | Error)[],
  calls: string[] = [],
): LlmProvider {
  return {
    name,
    async *stream(request) {
      calls.push(`${name}:${request.model}`);
      for (const step of script) {
        if (step instanceof Error) {
          throw step;
        }
        yield { type: 'token', text: step };
      }
      yield { type: 'usage', inputTokens: 5, outputTokens: script.length };
    },
  };
}

const retryable = (provider: ProviderName) =>
  new LlmError(provider, `${provider} is down`, { retryable: true, status: 503 });

async function collect(stream: AsyncIterable<unknown>) {
  const events: unknown[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

const call = { purpose: 'chat' as const, messages: [{ role: 'user' as const, content: 'hi' }] };

describe('createLlm', () => {
  it('streams from the first model and says which one answered', async () => {
    const llm = createLlm({ mode: 'live', providers: { groq: scripted('groq', ['Hi']) }, logger });

    expect(await collect(llm.stream(call))).toEqual([
      { type: 'model', provider: 'groq', model: 'openai/gpt-oss-120b' },
      { type: 'token', text: 'Hi' },
      { type: 'usage', inputTokens: 5, outputTokens: 1 },
    ]);
  });

  it('falls back to the next model when the first fails before answering', async () => {
    const calls: string[] = [];
    let attempt = 0;
    const flaky: LlmProvider = {
      name: 'groq',
      async *stream(request): AsyncGenerator<StreamEvent> {
        calls.push(request.model);
        attempt += 1;
        if (attempt === 1) {
          throw retryable('groq');
        }
        yield { type: 'token', text: 'from fallback' };
      },
    };
    const llm = createLlm({ mode: 'live', providers: { groq: flaky }, logger });

    const result = await llm.complete(call);

    expect(calls).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(result).toMatchObject({ text: 'from fallback', model: 'openai/gpt-oss-20b' });
  });

  it('never switches models once text has been sent, nor after a stop or a bad request', async () => {
    const calls: string[] = [];
    const midAnswer = createLlm({
      mode: 'live',
      providers: { groq: scripted('groq', ['Half', retryable('groq')], calls) },
      logger,
    });
    await expect(collect(midAnswer.stream(call))).rejects.toThrow('groq is down');
    expect(calls).toHaveLength(1);

    const badRequest = createLlm({
      mode: 'live',
      providers: {
        groq: scripted('groq', [new LlmError('groq', 'bad request', { retryable: false })], calls),
      },
      logger,
    });
    await expect(collect(badRequest.stream(call))).rejects.toThrow('bad request');
    expect(calls).toHaveLength(2);

    const controller = new AbortController();
    controller.abort();
    const stopped = createLlm({
      mode: 'live',
      providers: { groq: scripted('groq', [retryable('groq')], calls) },
      logger,
    });
    await expect(collect(stopped.stream({ ...call, signal: controller.signal }))).rejects.toThrow();
    expect(calls).toHaveLength(3);
  });

  it('uses only providers with keys, and refuses a purpose none can serve', async () => {
    const llm = createLlm({ mode: 'live', providers: { groq: scripted('groq', ['ok']) }, logger });

    // Code prefers OpenRouter; without its key the Groq fallback answers.
    await expect(llm.complete({ ...call, purpose: 'code' })).resolves.toMatchObject({
      provider: 'groq',
    });
    // Images need Gemini, which has no key here.
    await expect(llm.complete({ ...call, purpose: 'vision' })).rejects.toMatchObject({
      code: 'service_unavailable',
    });
  });

  it('answers everything from the mock provider in mock mode', async () => {
    const llm = createLlm({
      mode: 'mock',
      providers: { mock: createMockProvider({ delayMs: 0 }), groq: scripted('groq', ['real']) },
      logger,
    });

    const result = await llm.complete({ ...call, purpose: 'vision' });

    expect(result.provider).toBe('mock');
    expect(result.text).toContain('mock answer');
  });
});

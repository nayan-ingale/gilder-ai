import { type LlmProvider, type StreamEvent, type StreamRequest, textOf } from './types.ts';

/**
 * Streams canned answers, so the whole app runs with no API keys (LLM_MODE=mock). Tests and CI
 * use it. It behaves like a real provider: word by word, with token usage, and it stops when
 * the caller aborts.
 */

export interface MockProviderOptions {
  /** Pause between words. Default 15 ms, so streaming is visible; tests use 0. */
  delayMs?: number;
  /** What to answer. The default echoes the question, or routes everything to chat. */
  respond?: (request: StreamRequest) => string;
}

export function defaultMockAnswer(request: StreamRequest): string {
  if (request.json) {
    return JSON.stringify({ agent: 'chat', confidence: 0.9 });
  }
  const question = [...request.messages].reverse().find((message) => message.role === 'user');
  const excerpt = textOf(question?.content ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return [
    `This is a mock answer to: "${excerpt}".`,
    '',
    'Mock mode streams canned text, so the app runs without any AI provider keys.',
  ].join('\n');
}

/** Roughly four characters per token, the usual rule of thumb for English. */
const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
}

export function createMockProvider(options: MockProviderOptions = {}): LlmProvider {
  const delayMs = options.delayMs ?? 15;
  const respond = options.respond ?? defaultMockAnswer;

  return {
    name: 'mock',
    async *stream(request: StreamRequest): AsyncGenerator<StreamEvent> {
      const answer = respond(request);
      // Words keep their following space, so joining the tokens gives the answer back exactly.
      const words = answer.match(/\S+\s*|\s+/g) ?? [];
      for (const text of words) {
        if (request.signal?.aborted) {
          throw abortError(request.signal);
        }
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        yield { type: 'token', text };
      }
      yield {
        type: 'usage',
        inputTokens: estimateTokens(
          request.messages.map((message) => textOf(message.content)).join('\n'),
        ),
        outputTokens: estimateTokens(answer),
      };
    },
  };
}

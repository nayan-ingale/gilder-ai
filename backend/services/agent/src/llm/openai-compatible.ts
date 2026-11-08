import { readSseData } from './sse.ts';
import {
  LlmError,
  type LlmProvider,
  type ProviderName,
  type StreamEvent,
  type StreamRequest,
} from './types.ts';

/**
 * Groq, OpenRouter and Gemini all speak the OpenAI chat-completions API, so one client serves
 * them. It streams tokens, reports token usage, and gives up when the provider is slow to start
 * or goes quiet mid-answer.
 */

export interface OpenAiCompatibleOptions {
  name: Exclude<ProviderName, 'mock'>;
  baseUrl: string;
  apiKey: string;
  /** Extra headers, such as OpenRouter's app name. */
  headers?: Record<string, string>;
  /** How long to wait for the response to start. Default 20 seconds. */
  startTimeoutMs?: number;
  /** How long a started answer may go silent. Default 30 seconds. */
  idleTimeoutMs?: number;
}

interface CompletionChunk {
  choices?: { delta?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

// Rate limits and server trouble may clear up on another model; bad requests and auth won't.
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

export function createOpenAiCompatibleProvider(options: OpenAiCompatibleOptions): LlmProvider {
  const { name } = options;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const startTimeoutMs = options.startTimeoutMs ?? 20_000;
  const idleTimeoutMs = options.idleTimeoutMs ?? 30_000;

  return {
    name,
    async *stream(request: StreamRequest): AsyncGenerator<StreamEvent> {
      const controller = new AbortController();
      const abort = () => controller.abort(request.signal?.reason);
      request.signal?.addEventListener('abort', abort, { once: true });
      let timedOut: 'start' | 'idle' | undefined;
      const startTimer = setTimeout(() => {
        timedOut = 'start';
        controller.abort();
      }, startTimeoutMs);

      try {
        let response: Response;
        try {
          response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${options.apiKey}`,
              'content-type': 'application/json',
              ...options.headers,
            },
            body: JSON.stringify({
              model: request.model,
              messages: request.messages,
              stream: true,
              stream_options: { include_usage: true },
              ...(request.json ? { response_format: { type: 'json_object' } } : {}),
              ...(request.maxTokens ? { max_completion_tokens: request.maxTokens } : {}),
              ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
              ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
            }),
            signal: controller.signal,
          });
        } catch (error) {
          throw callFailed(name, error, timedOut, request.signal);
        } finally {
          clearTimeout(startTimer);
        }

        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => '');
          throw new LlmError(name, `${name} answered ${response.status}: ${detail.slice(0, 200)}`, {
            retryable: RETRYABLE_STATUS.has(response.status),
            status: response.status,
          });
        }

        // Some providers repeat the usage in more than one chunk; report the last one, once.
        let usage: StreamEvent | undefined;
        try {
          const events = readSseData(response.body, {
            idleMs: idleTimeoutMs,
            onIdle: () => {
              timedOut = 'idle';
              controller.abort();
            },
          });
          for await (const data of events) {
            if (data === '[DONE]') {
              break;
            }
            const chunk = JSON.parse(data) as CompletionChunk;
            // Reasoning models send their thinking in a separate field; only the answer counts.
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) {
              yield { type: 'token', text };
            }
            if (chunk.usage) {
              usage = {
                type: 'usage',
                inputTokens: chunk.usage.prompt_tokens ?? 0,
                outputTokens: chunk.usage.completion_tokens ?? 0,
              };
            }
          }
        } catch (error) {
          throw callFailed(name, error, timedOut, request.signal);
        }
        if (usage) {
          yield usage;
        }
      } finally {
        clearTimeout(startTimer);
        request.signal?.removeEventListener('abort', abort);
      }
    },
  };
}

function callFailed(
  name: Exclude<ProviderName, 'mock'>,
  error: unknown,
  timedOut: 'start' | 'idle' | undefined,
  signal: AbortSignal | undefined,
): Error {
  if (error instanceof LlmError) {
    return error;
  }
  // A stop from the caller is not a provider failure: pass the abort through untouched.
  if (signal?.aborted) {
    return signal.reason instanceof Error
      ? signal.reason
      : new DOMException('Aborted', 'AbortError');
  }
  if (timedOut === 'start') {
    return new LlmError(name, `${name} did not start answering in time`, {
      retryable: true,
      cause: error,
    });
  }
  if (timedOut === 'idle') {
    return new LlmError(name, `${name} went silent mid-answer`, { retryable: true, cause: error });
  }
  return new LlmError(name, `${name} could not be reached`, { retryable: true, cause: error });
}

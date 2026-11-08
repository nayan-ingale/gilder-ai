import { AppError, type Logger } from '@gilder/shared';
import { MODEL_ROUTES, type ModelPurpose, type ModelTarget } from './models.ts';
import {
  LlmError,
  type LlmMessage,
  type LlmProvider,
  type ProviderName,
  type StreamEvent,
} from './types.ts';

/**
 * The one way the agents call a model. It picks the models for a purpose, streams from the
 * first, and falls back to the next only if the call fails before its first token: once text
 * has reached the user, a switch would mix two answers, so the error goes up instead.
 */

export type LlmMode = 'live' | 'mock';

export interface LlmOptions {
  mode: LlmMode;
  /** The providers that have keys. In mock mode only `mock` is used. */
  providers: Partial<Record<ProviderName, LlmProvider>>;
  logger: Logger;
}

export interface LlmCall {
  purpose: ModelPurpose;
  messages: LlmMessage[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/** Tells the caller which model is answering, before its first token or usage. */
export type LlmEvent = StreamEvent | { type: 'model'; provider: ProviderName; model: string };

export interface LlmResult {
  text: string;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Llm {
  stream(call: LlmCall): AsyncGenerator<LlmEvent>;
  /** Streams to the end and returns the whole text, for short calls such as routing. */
  complete(call: LlmCall): Promise<LlmResult>;
}

const MOCK_TARGET = { provider: 'mock', model: 'mock' } as const;

export function createLlm(options: LlmOptions): Llm {
  const { logger } = options;

  function targetsFor(
    purpose: ModelPurpose,
  ): { provider: ProviderName; model: string; reasoningEffort?: ModelTarget['reasoningEffort'] }[] {
    if (options.mode === 'mock') {
      return [MOCK_TARGET];
    }
    const routes: readonly ModelTarget[] = MODEL_ROUTES[purpose];
    return routes.filter((target) => options.providers[target.provider]);
  }

  async function* stream(call: LlmCall): AsyncGenerator<LlmEvent> {
    const targets = targetsFor(call.purpose);
    if (targets.length === 0) {
      throw new AppError('service_unavailable', 'This kind of answer is not set up on this server');
    }

    let lastError: unknown;
    for (const target of targets) {
      const provider = options.providers[target.provider];
      if (!provider) {
        continue;
      }
      let started = false;
      try {
        for await (const event of provider.stream({
          model: target.model,
          messages: call.messages,
          ...(call.json ? { json: true } : {}),
          ...(call.maxTokens ? { maxTokens: call.maxTokens } : {}),
          ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
          ...(target.reasoningEffort ? { reasoningEffort: target.reasoningEffort } : {}),
          ...(call.signal ? { signal: call.signal } : {}),
        })) {
          if (!started) {
            started = true;
            yield { type: 'model', provider: target.provider, model: target.model };
          }
          yield event;
        }
        if (!started) {
          // An empty answer is still an answer from this model.
          yield { type: 'model', provider: target.provider, model: target.model };
        }
        return;
      } catch (error) {
        const canFallBack =
          !started && !call.signal?.aborted && error instanceof LlmError && error.retryable;
        if (!canFallBack) {
          throw error;
        }
        logger.warn(
          { provider: target.provider, model: target.model, err: error },
          'model failed before answering; trying the next one',
        );
        lastError = error;
      }
    }
    throw lastError;
  }

  return {
    stream,
    async complete(call) {
      const result: LlmResult = {
        text: '',
        provider: MOCK_TARGET.provider,
        model: MOCK_TARGET.model,
        inputTokens: 0,
        outputTokens: 0,
      };
      for await (const event of stream(call)) {
        if (event.type === 'model') {
          result.provider = event.provider;
          result.model = event.model;
        } else if (event.type === 'token') {
          result.text += event.text;
        } else {
          result.inputTokens = event.inputTokens;
          result.outputTokens = event.outputTokens;
        }
      }
      return result;
    },
  };
}

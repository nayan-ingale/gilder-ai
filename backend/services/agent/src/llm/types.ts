/** The provider layer's vocabulary: one way to stream an answer, whichever company serves it. */

export const PROVIDER_NAMES = ['groq', 'openrouter', 'gemini', 'mock'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamRequest {
  model: string;
  messages: LlmMessage[];
  /** Asks for a JSON object (for routing and other structured output). */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** For reasoning models: how long to think before answering. */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Aborts the call: a user's stop, or the client going away. */
  signal?: AbortSignal;
}

export type StreamEvent =
  { type: 'token'; text: string } | { type: 'usage'; inputTokens: number; outputTokens: number };

export interface LlmProvider {
  name: ProviderName;
  stream(request: StreamRequest): AsyncIterable<StreamEvent>;
}

/** Why a provider call failed. `retryable` errors may move on to the fallback model. */
export class LlmError extends Error {
  readonly provider: ProviderName;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(
    provider: ProviderName,
    message: string,
    options: { retryable: boolean; status?: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = 'LlmError';
    this.provider = provider;
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

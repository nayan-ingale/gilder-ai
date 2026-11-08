import type { ProviderName } from './types.ts';

/**
 * Which model answers each kind of call, in order: the first is used, and the next ones are the
 * fallbacks when a provider fails before its first token. Change models here, nowhere else.
 */

export interface ModelTarget {
  provider: Exclude<ProviderName, 'mock'>;
  model: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export const MODEL_ROUTES = {
  /** Picks the agent for a message: small and fast, JSON out. */
  router: [{ provider: 'groq', model: 'openai/gpt-oss-20b', reasoningEffort: 'low' }],
  /** A short title for a new chat. */
  title: [{ provider: 'groq', model: 'openai/gpt-oss-20b', reasoningEffort: 'low' }],
  /** Everyday answers. */
  chat: [
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoningEffort: 'low' },
    { provider: 'groq', model: 'openai/gpt-oss-20b', reasoningEffort: 'low' },
  ],
  /** Answers written from other material: search results, documents, file outlines. */
  write: [
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoningEffort: 'low' },
    { provider: 'groq', model: 'openai/gpt-oss-20b', reasoningEffort: 'low' },
  ],
  /** Code files. */
  code: [
    { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoningEffort: 'medium' },
  ],
  /** Questions about an image. (Google retired gemini-2.5-flash for new keys.) */
  vision: [
    { provider: 'gemini', model: 'gemini-3.5-flash', reasoningEffort: 'low' },
    { provider: 'gemini', model: 'gemini-3.8-flash', reasoningEffort: 'low' },
    { provider: 'gemini', model: 'gemini-flash-latest', reasoningEffort: 'low' },
  ],
} as const satisfies Record<string, readonly ModelTarget[]>;

export type ModelPurpose = keyof typeof MODEL_ROUTES;

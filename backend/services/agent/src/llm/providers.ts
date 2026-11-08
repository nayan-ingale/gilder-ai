import { createMockProvider } from './mock.ts';
import { createOpenAiCompatibleProvider } from './openai-compatible.ts';
import type { LlmProvider, ProviderName } from './types.ts';

export interface ProviderKeys {
  groq?: string | undefined;
  openrouter?: string | undefined;
  gemini?: string | undefined;
}

/** The providers that have keys, plus the mock one, which needs none. */
export function buildProviders(keys: ProviderKeys): Partial<Record<ProviderName, LlmProvider>> {
  const providers: Partial<Record<ProviderName, LlmProvider>> = { mock: createMockProvider() };
  if (keys.groq) {
    providers.groq = createOpenAiCompatibleProvider({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: keys.groq,
    });
  }
  if (keys.openrouter) {
    providers.openrouter = createOpenAiCompatibleProvider({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: keys.openrouter,
      // OpenRouter shows these on its dashboard, to tell apps apart.
      headers: { 'x-title': 'GilderAi' },
    });
  }
  if (keys.gemini) {
    providers.gemini = createOpenAiCompatibleProvider({
      name: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: keys.gemini,
    });
  }
  return providers;
}

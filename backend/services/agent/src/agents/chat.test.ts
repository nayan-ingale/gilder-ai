import { createLogger } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { createLlm } from '../llm/llm.ts';
import { createMockProvider } from '../llm/mock.ts';
import type { StreamRequest } from '../llm/types.ts';
import { CHAT_SYSTEM_PROMPT, chatAgent } from './chat.ts';

describe('chatAgent', () => {
  it('sends the fixed prompt, the memory and the new message, and streams the answer', async () => {
    let seen: StreamRequest | undefined;
    const llm = createLlm({
      mode: 'mock',
      providers: {
        mock: createMockProvider({
          delayMs: 0,
          respond: (request) => {
            seen = request;
            return 'Sure thing';
          },
        }),
      },
      logger: createLogger({ service: 'agent', level: 'silent' }),
    });

    const tokens: string[] = [];
    for await (const event of chatAgent.run({
      text: 'And in winter?',
      memory: [
        { role: 'user', content: 'Best time to visit Goa?' },
        { role: 'assistant', content: 'November to February.' },
      ],
      llm,
      signal: new AbortController().signal,
    })) {
      if (event.type === 'token') {
        tokens.push(event.text);
      }
    }

    expect(tokens.join('')).toBe('Sure thing');
    expect(seen?.messages).toEqual([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: 'Best time to visit Goa?' },
      { role: 'assistant', content: 'November to February.' },
      { role: 'user', content: 'And in winter?' },
    ]);
  });
});

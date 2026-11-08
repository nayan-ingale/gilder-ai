import { createLogger } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { createLlm } from '../llm/llm.ts';
import { createMockProvider } from '../llm/mock.ts';
import { codeAgent } from './code.ts';
import type { AgentEvent } from './types.ts';

describe('code agent', () => {
  it('streams the answer, then sends the files it contains', async () => {
    const answer = 'A greeter.\n\n### `hello.py`\n```python\nprint("hi")\n```\n';
    const llm = createLlm({
      mode: 'mock',
      providers: { mock: createMockProvider({ delayMs: 0, respond: () => answer }) },
      logger: createLogger({ service: 'agent', level: 'silent' }),
    });

    const events: AgentEvent[] = [];
    for await (const event of codeAgent.run({
      text: 'hello world in python',
      memory: [],
      llm,
      signal: new AbortController().signal,
    })) {
      events.push(event);
    }

    expect(events.flatMap((event) => (event.type === 'token' ? [event.text] : [])).join('')).toBe(
      answer,
    );
    expect(events.at(-1)).toEqual({
      type: 'artifact',
      files: [{ name: 'hello.py', language: 'python', content: 'print("hi")' }],
    });
  });
});

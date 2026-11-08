import { createLogger, z } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { createLlm } from './llm/llm.ts';
import { createMockProvider } from './llm/mock.ts';
import { completeJson } from './structured.ts';

const logger = createLogger({ service: 'agent', level: 'silent' });
const schema = z.object({ agent: z.enum(['chat', 'code']), confidence: z.number() });

/** An LLM whose replies come from `replies`, one per call, recording what it was asked. */
function llmReplying(replies: string[]) {
  const asked: string[][] = [];
  const llm = createLlm({
    mode: 'mock',
    providers: {
      mock: createMockProvider({
        delayMs: 0,
        respond: (request) => {
          asked.push(request.messages.map((message) => message.content));
          return replies[asked.length - 1] ?? '';
        },
      }),
    },
    logger,
  });
  return { llm, asked };
}

const call = { purpose: 'router' as const, messages: [{ role: 'user' as const, content: 'hi' }] };

describe('completeJson', () => {
  it('returns a reply that fits the schema', async () => {
    const { llm, asked } = llmReplying(['{"agent":"code","confidence":0.8}']);

    await expect(completeJson(llm, call, schema)).resolves.toMatchObject({
      value: { agent: 'code', confidence: 0.8 },
    });
    expect(asked).toHaveLength(1);
  });

  it('repairs once, showing the model its reply and the problem', async () => {
    const { llm, asked } = llmReplying(['{"agent":"robot"}', '{"agent":"chat","confidence":1}']);

    const { value } = await completeJson(llm, call, schema);

    expect(value).toEqual({ agent: 'chat', confidence: 1 });
    expect(asked[1]).toContain('{"agent":"robot"}');
    expect(asked[1]?.at(-1)).toContain('did not match the required format');
  });

  it('fails with a typed error after the repair also fails', async () => {
    const { llm } = llmReplying(['not json', 'still not json']);

    await expect(completeJson(llm, call, schema)).rejects.toMatchObject({
      code: 'service_unavailable',
      message: 'The AI returned an answer in the wrong format',
    });
  });
});

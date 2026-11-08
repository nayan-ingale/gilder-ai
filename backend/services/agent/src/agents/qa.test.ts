import { createLogger } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { createLlm } from '../llm/llm.ts';
import { createMockProvider } from '../llm/mock.ts';
import { type StreamRequest, textOf } from '../llm/types.ts';
import { mockEmbedder } from '../rag/embeddings.ts';
import { createMemoryVectorStore } from '../rag/vector-store.ts';
import { createImageQaAgent } from './image-qa.ts';
import { createPdfQaAgent, PDF_QA_SYSTEM_PROMPT } from './pdf-qa.ts';
import type { AgentContext, AgentEvent } from './types.ts';

function llmRecording(answer = 'Answer [p. 2].') {
  const asked: StreamRequest[] = [];
  const llm = createLlm({
    mode: 'mock',
    providers: {
      mock: createMockProvider({
        delayMs: 0,
        respond: (request) => {
          asked.push(request);
          return answer;
        },
      }),
    },
    logger: createLogger({ service: 'agent', level: 'silent' }),
  });
  return { llm, asked };
}

async function collect(run: AsyncGenerator<AgentEvent>) {
  const events: AgentEvent[] = [];
  for await (const event of run) {
    events.push(event);
  }
  return events;
}

const base = (llm: AgentContext['llm']): AgentContext => ({
  text: 'How long do refunds take?',
  memory: [],
  llm,
  signal: new AbortController().signal,
  userId: 'u1',
  chatId: 'chat-1',
});

describe('PDF questions', () => {
  it('finds the closest passages in the user’s documents, cites them, and answers from them', async () => {
    const vectors = createMemoryVectorStore();
    const texts = ['Our office opens at 9am.', 'Refunds take seven working days after approval.'];
    const embedded = await mockEmbedder.embed(texts, 'document');
    await vectors.upsert(
      texts.map((text, index) => ({
        vector: embedded[index] ?? [],
        payload: { userId: 'u1', documentId: 'doc-1', chatId: 'chat-1', page: index + 1, text },
      })),
    );
    const { llm, asked } = llmRecording();
    const agent = createPdfQaAgent({
      embedder: mockEmbedder,
      vectors,
      documentsFor: async () => [{ id: 'doc-1', name: 'policy.pdf' }],
    });

    const events = await collect(agent.run(base(llm)));

    const citations = events.find((event) => event.type === 'citations');
    expect(citations?.type === 'citations' && citations.items[0]).toMatchObject({
      documentId: 'doc-1',
      name: 'policy.pdf',
      page: 2,
    });
    expect(asked[0]?.messages[0]).toEqual({ role: 'system', content: PDF_QA_SYSTEM_PROMPT });
    expect(textOf(asked[0]?.messages.at(-1)?.content ?? '')).toContain(
      '[policy.pdf, p. 2]\nRefunds take seven',
    );
  });

  it('refuses when the chat has no readable PDF', async () => {
    const { llm } = llmRecording();
    const agent = createPdfQaAgent({
      embedder: mockEmbedder,
      vectors: createMemoryVectorStore(),
      documentsFor: async () => [],
    });

    await expect(collect(agent.run(base(llm)))).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('image questions', () => {
  it('shows the attached image to the vision model as a data URL', async () => {
    const { llm, asked } = llmRecording('A cat.');
    const agent = createImageQaAgent({ readImage: async () => Buffer.from('fake-png-bytes') });

    const events = await collect(
      agent.run({
        ...base(llm),
        text: 'What is this?',
        attachments: [{ fileId: 'f1', purpose: 'image', name: 'cat.png', mime: 'image/png' }],
      }),
    );

    expect(events.some((event) => event.type === 'token')).toBe(true);
    expect(asked[0]?.messages.at(-1)?.content).toEqual([
      { type: 'text', text: 'What is this?' },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`,
        },
      },
    ]);
  });

  it('needs an attached image', async () => {
    const { llm } = llmRecording();
    const agent = createImageQaAgent({ readImage: async () => Buffer.alloc(0) });

    await expect(collect(agent.run(base(llm)))).rejects.toMatchObject({ code: 'bad_request' });
  });
});

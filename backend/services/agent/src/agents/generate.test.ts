import { createLogger } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryFileStore } from '../files/file-store.ts';
import { FileModel } from '../files/models.ts';
import { mockImage } from '../generate/images.ts';
import { createLlm } from '../llm/llm.ts';
import { createMockProvider } from '../llm/mock.ts';
import { createImageAgent, createPdfAgent, createSlidesAgent } from './generate.ts';
import type { AgentContext, AgentEvent } from './types.ts';

let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo();
  await FileModel.init();
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await FileModel.deleteMany({});
});

function context(reply = ''): AgentContext {
  return {
    text: 'A short guide to composting at home',
    memory: [],
    llm: createLlm({
      mode: 'mock',
      providers: { mock: createMockProvider({ delayMs: 0, respond: () => reply }) },
      logger: createLogger({ service: 'agent', level: 'silent' }),
    }),
    signal: new AbortController().signal,
    userId: 'u1',
    chatId: 'chat-1',
  };
}

async function collect(run: AsyncGenerator<AgentEvent>) {
  const events: AgentEvent[] = [];
  for await (const event of run) {
    events.push(event);
  }
  return events;
}

describe('generation agents', () => {
  it('writes a PDF from the model’s outline, reports progress, and saves it as the user’s file', async () => {
    const store = createMemoryFileStore();
    const outline = JSON.stringify({
      title: 'Composting at home',
      summary: 'A quick guide.',
      sections: [{ heading: 'Start', paragraphs: ['Pick a bin.'], bullets: ['Greens', 'Browns'] }],
    });

    const events = await collect(
      createPdfAgent({ store, drawImage: mockImage, mode: 'live' }).run(context(outline)),
    );

    expect(
      events
        .filter((event) => event.type === 'progress')
        .map((event) => event.type === 'progress' && event.current),
    ).toEqual([1, 2, 3]);
    const file = events.find((event) => event.type === 'file');
    expect(file?.type === 'file' && file.file).toMatchObject({
      kind: 'pdf',
      name: 'composting-at-home.pdf',
    });
    const saved = await FileModel.findOne({ kind: 'generated' });
    expect(saved).toMatchObject({
      userId: 'u1',
      chatId: 'chat-1',
      purpose: 'pdf',
      mime: 'application/pdf',
      status: 'ready',
    });
    expect(saved?.s3Key).toBe(`users/u1/generated/${saved?.id}`);
    expect(
      store.objects
        .get(saved?.s3Key ?? '')
        ?.bytes.subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    expect(events.some((event) => event.type === 'usage')).toBe(true);
  });

  it('makes slides and images in mock mode without asking the model', async () => {
    const store = createMemoryFileStore();
    const tools = { store, drawImage: mockImage, mode: 'mock' as const };

    const slides = await collect(createSlidesAgent(tools).run(context('not json')));
    const image = await collect(createImageAgent(tools).run(context('not json')));

    const kinds = [...slides, ...image].flatMap((event) =>
      event.type === 'file' ? [event.file.kind] : [],
    );
    expect(kinds).toEqual(['slides', 'image']);
    expect((await FileModel.find()).map((file) => file.mime).sort()).toEqual([
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
    ]);
  });

  it('refuses an outline that does not fit, after one repair', async () => {
    const store = createMemoryFileStore();

    await expect(
      collect(
        createPdfAgent({ store, drawImage: mockImage, mode: 'live' }).run(context('{"title": ""}')),
      ),
    ).rejects.toMatchObject({ code: 'service_unavailable' });
    expect(store.objects.size).toBe(0);
  });
});

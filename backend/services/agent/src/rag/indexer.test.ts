import { createLogger, mongoose } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryFileStore } from '../files/file-store.ts';
import { DocumentModel, FileModel } from '../files/models.ts';
import { makePdf } from '../files/test-pdf.ts';
import { mockEmbedder } from './embeddings.ts';
import { indexPdf } from './indexer.ts';
import { createMemoryVectorStore } from './vector-store.ts';

const logger = createLogger({ service: 'agent', level: 'silent' });
let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo();
  await Promise.all([FileModel.init(), DocumentModel.init()]);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([FileModel.deleteMany({}), DocumentModel.deleteMany({})]);
});

async function uploadedPdf(store: ReturnType<typeof createMemoryFileStore>, pages: string[]) {
  const id = new mongoose.Types.ObjectId();
  const file = await FileModel.create({
    _id: id,
    userId: 'u1',
    chatId: 'chat-1',
    kind: 'upload',
    purpose: 'pdf',
    name: 'notes.pdf',
    s3Key: `users/u1/uploads/${id.toString()}`,
    mime: 'application/pdf',
    sizeBytes: 100,
    status: 'ready',
    pageCount: pages.length,
  });
  store.simulateUpload(file.s3Key, makePdf(pages), 'application/pdf');
  const document = await DocumentModel.create({
    fileId: id,
    userId: 'u1',
    chatId: 'chat-1',
    pageCount: pages.length,
  });
  return { file, document };
}

describe('indexPdf', () => {
  it('stores each page’s text with its page, owner, document and chat, then marks it ready', async () => {
    const store = createMemoryFileStore();
    const vectors = createMemoryVectorStore();
    const { file, document } = await uploadedPdf(store, [
      'Goa beaches are best in November',
      'Kerala backwaters by houseboat',
    ]);

    await indexPdf(file, { store, embedder: mockEmbedder, vectors, logger });

    expect((await DocumentModel.findById(document._id))?.status).toBe('ready');
    expect(vectors.points.map((point) => point.payload)).toEqual([
      {
        userId: 'u1',
        documentId: document.id,
        chatId: 'chat-1',
        page: 1,
        text: 'Goa beaches are best in November',
      },
      {
        userId: 'u1',
        documentId: document.id,
        chatId: 'chat-1',
        page: 2,
        text: 'Kerala backwaters by houseboat',
      },
    ]);
    const [question] = await mockEmbedder.embed(['houseboat backwaters'], 'query');
    const hits = await vectors.search(
      question ?? [],
      { userId: 'u1', documentIds: [document.id] },
      1,
    );
    expect(hits[0]?.payload.page).toBe(2);
    expect(
      await vectors.search(question ?? [], { userId: 'u2', documentIds: [document.id] }, 1),
    ).toEqual([]);
  });

  it('marks a PDF with no text as failed, with the reason', async () => {
    const store = createMemoryFileStore();
    const { file, document } = await uploadedPdf(store, ['', '']);

    await indexPdf(file, {
      store,
      embedder: mockEmbedder,
      vectors: createMemoryVectorStore(),
      logger,
    });

    expect(await DocumentModel.findById(document._id)).toMatchObject({
      status: 'failed',
      error: 'This PDF has no text to read (it may be scanned images)',
    });
  });
});

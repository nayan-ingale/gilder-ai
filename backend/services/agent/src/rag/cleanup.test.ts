import { createLogger, mongoose } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryFileStore } from '../files/file-store.ts';
import { DocumentModel, FileModel } from '../files/models.ts';
import type { ChatService } from '../services.ts';
import { cleanUpDeletedChats } from './cleanup.ts';
import { createMemoryVectorStore } from './vector-store.ts';

let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo();
  await Promise.all([FileModel.init(), DocumentModel.init()]);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

describe('cleanUpDeletedChats', () => {
  it('removes the files, documents and vectors of deleted chats only, per user', async () => {
    const store = createMemoryFileStore();
    const vectors = createMemoryVectorStore();
    const add = async (userId: string, chatId: string) => {
      const id = new mongoose.Types.ObjectId();
      const s3Key = `users/${userId}/uploads/${id.toString()}`;
      await FileModel.create({
        _id: id,
        userId,
        chatId,
        kind: 'upload',
        purpose: 'pdf',
        name: 'a.pdf',
        s3Key,
        mime: 'application/pdf',
        sizeBytes: 1,
        status: 'ready',
      });
      const document = await DocumentModel.create({
        fileId: id,
        userId,
        chatId,
        pageCount: 1,
        status: 'ready',
      });
      store.simulateUpload(s3Key, Buffer.from('%PDF-'), 'application/pdf');
      await vectors.upsert([
        { vector: [1], payload: { userId, documentId: document.id, chatId, page: 1, text: 'x' } },
      ]);
    };
    await add('u1', 'gone');
    await add('u1', 'kept');
    await add('u2', 'gone');
    const asked: [string, string[]][] = [];
    const chat = {
      deletedChats: async (userId: string, chatIds: string[]) => {
        asked.push([userId, [...chatIds].sort()]);
        return userId === 'u1' ? chatIds.filter((id) => id === 'gone') : [];
      },
    } as unknown as ChatService;

    const removed = await cleanUpDeletedChats({
      chat,
      store,
      vectors,
      logger: createLogger({ service: 'agent', level: 'silent' }),
    });

    expect(removed).toBe(1);
    expect(asked.sort()).toEqual([
      ['u1', ['gone', 'kept']],
      ['u2', ['gone']],
    ]);
    expect((await FileModel.find()).map((file) => `${file.userId}/${file.chatId}`).sort()).toEqual([
      'u1/kept',
      'u2/gone',
    ]);
    expect(await DocumentModel.countDocuments()).toBe(2);
    expect(store.objects.size).toBe(2);
    expect(
      vectors.points.map((point) => `${point.payload.userId}/${point.payload.chatId}`).sort(),
    ).toEqual(['u1/kept', 'u2/gone']);
  });
});

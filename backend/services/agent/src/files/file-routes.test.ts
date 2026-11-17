import {
  AppError,
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  signInternalToken,
} from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.ts';
import type { ChatService } from '../services.ts';
import { countPdfPages } from './file-routes.ts';
import { createMemoryFileStore } from './file-store.ts';
import { DocumentModel, FileModel } from './models.ts';
import { makePdf } from './test-pdf.ts';

const logger = createLogger({ service: 'agent', level: 'silent' });
let mongo: TestMongo;
let gatewayKey: InternalKey;
let gatewayPublicKey: InternalKey;
let store: ReturnType<typeof createMemoryFileStore>;
const onPdfReady = vi.fn();
const CHAT = '65f0c0ffee1234567890aaaa';

/** Chat ownership as the chat service answers it: only u1 owns CHAT. */
const chat = {
  getChat: async (userId: string, chatId: string) => {
    if (userId !== 'u1' || chatId !== CHAT) {
      throw new AppError('not_found', 'No such chat');
    }
    return { id: chatId, title: 'New chat', pinned: false, lastMessageAt: '', createdAt: '' };
  },
} as unknown as ChatService;

beforeAll(async () => {
  mongo = await startTestMongo();
  await Promise.all([FileModel.init(), DocumentModel.init()]);
  const pair = await generateInternalKeyPair();
  gatewayKey = await importInternalPrivateKey(pair.privateKey);
  gatewayPublicKey = await importInternalPublicKey(pair.publicKey);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([FileModel.deleteMany({}), DocumentModel.deleteMany({})]);
  store = createMemoryFileStore();
  onPdfReady.mockReset();
});

async function as(userId: string, withStore = true) {
  const token = await signInternalToken(gatewayKey, 'agent', { userId });
  const app = createApp({
    logger,
    internalPublicKey: gatewayPublicKey,
    files: { ...(withStore ? { store } : {}), chat, onPdfReady },
  });
  return {
    get: (path: string) => request(app).get(path).set(INTERNAL_TOKEN_HEADER, token),
    post: (path: string) => request(app).post(path).set(INTERNAL_TOKEN_HEADER, token),
  };
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

async function start(body: Record<string, unknown>, userId = 'u1') {
  return (await as(userId)).post('/files/uploads').send({ chatId: CHAT, ...body });
}

describe('starting an upload', () => {
  it('gives a signed form for a key made from IDs only, whatever the file is called (SEC-07)', async () => {
    const response = await start({
      name: '../../users/someone-else/../evil.pdf',
      mime: 'application/pdf',
      sizeBytes: 1_000,
    });

    expect(response.status).toBe(201);
    const { file, upload } = response.body;
    expect(file).toMatchObject({ name: 'evil.pdf', status: 'pending', purpose: 'pdf' });
    expect(upload.fields.key).toBe(`users/u1/uploads/${file.id}`);
    expect(upload.fields['Content-Type']).toBe('application/pdf');
  });

  it('refuses other types, files over the limit, and chats that are not yours', async () => {
    expect(
      (await start({ name: 'a.exe', mime: 'application/x-msdownload', sizeBytes: 10 })).status,
    ).toBe(415);
    expect(
      (await start({ name: 'big.png', mime: 'image/png', sizeBytes: 11 * 1024 * 1024 })).status,
    ).toBe(413);
    expect(
      (await start({ name: 'a.pdf', mime: 'application/pdf', sizeBytes: 10 }, 'u2')).status,
    ).toBe(404);
    expect(await FileModel.countDocuments()).toBe(0);
  });

  it('answers 503 when storage is not set up', async () => {
    const response = await (
      await as('u1', false)
    )
      .post('/files/uploads')
      .send({ chatId: CHAT, name: 'a.pdf', mime: 'application/pdf', sizeBytes: 10 });

    expect(response.status).toBe(503);
  });
});

describe('completing an upload', () => {
  async function uploaded(name: string, mime: string, bytes: Buffer, sizeBytes = bytes.length) {
    const { body } = await start({ name, mime, sizeBytes });
    store.simulateUpload(body.upload.fields.key as string, bytes, mime);
    return body.file.id as string;
  }

  it('accepts a real PDF, counts its pages and queues it for indexing', async () => {
    const id = await uploaded(
      'notes.pdf',
      'application/pdf',
      makePdf(['Page one', 'Page two', 'Page three']),
    );

    const response = await (await as('u1')).post(`/files/${id}/complete`);
    const again = await (await as('u1')).post(`/files/${id}/complete`);

    expect(response.body.file).toMatchObject({ status: 'ready', pageCount: 3 });
    expect(again.status).toBe(200);
    expect(onPdfReady).toHaveBeenCalledOnce();
    expect(await DocumentModel.findOne({ fileId: id })).toMatchObject({
      status: 'indexing',
      pageCount: 3,
    });
  });

  it('accepts an image whose bytes match its type', async () => {
    const id = await uploaded('photo.png', 'image/png', PNG);

    expect((await (await as('u1')).post(`/files/${id}/complete`)).body.file.status).toBe('ready');
    expect(onPdfReady).not.toHaveBeenCalled();
  });

  it('refuses a file whose bytes are not what it claims, and deletes it (SEC-07)', async () => {
    const id = await uploaded(
      'report.pdf',
      'application/pdf',
      Buffer.from('MZ\x90\x00 not a pdf at all'),
    );

    const response = await (await as('u1')).post(`/files/${id}/complete`);

    expect(response.status).toBe(415);
    expect(response.body.detail).toBe('That is not a PDF file');
    expect(store.objects.size).toBe(0);
    expect((await FileModel.findById(id))?.status).toBe('failed');
  });

  it("waits for the upload, and never completes someone else's file", async () => {
    const { body } = await start({ name: 'a.png', mime: 'image/png', sizeBytes: 40 });

    expect((await (await as('u1')).post(`/files/${body.file.id}/complete`)).status).toBe(409);
    expect((await (await as('u2')).post(`/files/${body.file.id}/complete`)).status).toBe(404);
  });
});

describe('reading files', () => {
  it('gives the owner a fresh signed link and nobody else anything', async () => {
    const { body } = await start({ name: 'photo.png', mime: 'image/png', sizeBytes: PNG.length });
    store.simulateUpload(body.upload.fields.key as string, PNG, 'image/png');
    await (await as('u1')).post(`/files/${body.file.id}/complete`);

    const link = await (await as('u1')).get(`/files/${body.file.id}/url`);
    const details = await (await as('u1')).get(`/files/${body.file.id}`);
    const theirs = await (await as('u2')).get(`/files/${body.file.id}/url`);

    expect(link.body).toMatchObject({ expiresInSeconds: 300 });
    expect(link.body.url).toContain('signed=1');
    expect(details.body.file.name).toBe('photo.png');
    expect(theirs.status).toBe(404);
  });

  it('opens the file in the browser with ?inline=1, and refuses other values', async () => {
    const { body } = await start({ name: 'photo.png', mime: 'image/png', sizeBytes: PNG.length });
    store.simulateUpload(body.upload.fields.key as string, PNG, 'image/png');
    await (await as('u1')).post(`/files/${body.file.id}/complete`);

    const shown = await (await as('u1')).get(`/files/${body.file.id}/url?inline=1`);
    const odd = await (await as('u1')).get(`/files/${body.file.id}/url?inline=yes`);

    expect(shown.body.url).toContain('inline=photo.png');
    expect(odd.status).toBe(400);
  });
});

describe('countPdfPages', () => {
  it('counts the pages of a real PDF', async () => {
    expect(await countPdfPages(makePdf(['a', 'b']))).toBe(2);
  });
});

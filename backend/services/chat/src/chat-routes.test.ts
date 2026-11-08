import {
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  mongoose,
  signInternalToken,
} from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { decodeCursor, encodeCursor } from './chat-routes.ts';
import { ConversationModel, MessageModel } from './models.ts';

const logger = createLogger({ service: 'chat', level: 'silent' });
let mongo: TestMongo;
let privateKey: InternalKey;
let publicKey: InternalKey;

beforeAll(async () => {
  mongo = await startTestMongo();
  await Promise.all([ConversationModel.init(), MessageModel.init()]);
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ConversationModel.deleteMany({}), MessageModel.deleteMany({})]);
});

const app = () => createApp({ logger, internalPublicKey: publicKey });

/** Tokens as the gateway would sign them, fresh for each test (they last 60 seconds). */
let tokens: Record<'u1' | 'u2' | 'none', string>;
beforeEach(async () => {
  const [u1, u2, none] = await Promise.all([
    signInternalToken(privateKey, 'chat', { userId: 'u1' }),
    signInternalToken(privateKey, 'chat', { userId: 'u2' }),
    signInternalToken(privateKey, 'chat', {}),
  ]);
  tokens = { u1, u2, none };
});

/** A request as the gateway would send it for this user. */
function as(userId: 'u1' | 'u2' | null, method: 'get' | 'post' | 'patch' | 'delete', path: string) {
  return request(app())
    [method](path)
    .set(INTERNAL_TOKEN_HEADER, tokens[userId ?? 'none']);
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe('POST /chats', () => {
  it('creates a "New chat", or one with the given title', async () => {
    const plain = await as('u1', 'post', '/chats').send({});
    const titled = await as('u1', 'post', '/chats').send({ title: '  Trip plans  ' });

    expect(plain.status).toBe(201);
    expect(plain.body.chat).toMatchObject({ title: 'New chat', pinned: false });
    expect(titled.body.chat.title).toBe('Trip plans');
    expect(await ConversationModel.countDocuments({ userId: 'u1' })).toBe(2);
  });

  it('rejects unknown fields and a token without a user', async () => {
    expect((await as('u1', 'post', '/chats').send({ userId: 'u2' })).status).toBe(400);
    expect((await as(null, 'post', '/chats').send({})).status).toBe(401);
  });
});

describe('GET /chats', () => {
  it('lists pinned chats first, then the rest by latest activity, only for this user', async () => {
    await ConversationModel.create([
      { userId: 'u1', title: 'old', lastMessageAt: minutesAgo(30) },
      { userId: 'u1', title: 'new', lastMessageAt: minutesAgo(1) },
      { userId: 'u1', title: 'pinned', lastMessageAt: minutesAgo(60), pinnedAt: new Date() },
      { userId: 'u1', title: 'deleted', deletedAt: new Date() },
      { userId: 'u2', title: 'theirs' },
    ]);

    const response = await as('u1', 'get', '/chats');

    expect(response.status).toBe(200);
    expect(response.body.items.map((chat: { title: string }) => chat.title)).toEqual([
      'pinned',
      'new',
      'old',
    ]);
    expect(response.body.nextCursor).toBeNull();
  });

  it('pages through every chat once with the cursor, even when times are equal', async () => {
    const sameTime = minutesAgo(5);
    await ConversationModel.create(
      Array.from({ length: 5 }, (_, index) => ({
        userId: 'u1',
        title: `chat ${index}`,
        lastMessageAt: index < 3 ? sameTime : minutesAgo(10 + index),
      })),
    );
    await ConversationModel.create({ userId: 'u1', title: 'pinned', pinnedAt: new Date() });

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const path: string = cursor ? `/chats?limit=2&cursor=${cursor}` : '/chats?limit=2';
      const response = await as('u1', 'get', path);
      seen.push(...response.body.items.map((chat: { title: string }) => chat.title));
      cursor = response.body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(seen[0]).toBe('pinned');
    expect(seen.filter((title) => title === 'pinned')).toHaveLength(1);
    expect(new Set(seen).size).toBe(6);
    expect(pages).toBe(3);
  });

  it('searches titles and message text, without deleted chats or other users', async () => {
    const [trip, , gone] = await ConversationModel.create([
      { userId: 'u1', title: 'Trip to Goa' },
      { userId: 'u1', title: 'Budget' },
      { userId: 'u1', title: 'Goa again', deletedAt: new Date() },
      { userId: 'u2', title: 'Goa for u2' },
    ]);
    const taxes = await ConversationModel.create({ userId: 'u1', title: 'Taxes' });
    await MessageModel.create([
      { conversationId: taxes._id, userId: 'u1', role: 'user', content: 'Is a Goa villa taxable?' },
      { conversationId: gone?._id, userId: 'u1', role: 'user', content: 'goa goa' },
    ]);

    const response = await as('u1', 'get', '/chats?query=goa');

    expect(response.status).toBe(200);
    expect(response.body.items.map((chat: { id: string }) => chat.id).sort()).toEqual(
      [trip?.id, taxes.id].sort(),
    );
  });

  it('rejects a cursor it did not make', async () => {
    const bad = Buffer.from('{"at":"now","id":"x"}').toString('base64url');

    expect((await as('u1', 'get', `/chats?cursor=${bad}`)).status).toBe(400);
    expect((await as('u1', 'get', '/chats?cursor=%%%')).status).toBe(400);
    expect((await as('u1', 'get', '/chats?limit=500')).status).toBe(400);
  });
});

describe('PATCH and DELETE /chats/:id', () => {
  it('renames, pins and unpins', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });

    const renamed = await as('u1', 'patch', `/chats/${chat.id}`).send({ title: 'Renamed' });
    const pinned = await as('u1', 'patch', `/chats/${chat.id}`).send({ pinned: true });
    const unpinned = await as('u1', 'patch', `/chats/${chat.id}`).send({ pinned: false });

    expect(renamed.body.chat.title).toBe('Renamed');
    expect(pinned.body.chat.pinned).toBe(true);
    expect(unpinned.body.chat.pinned).toBe(false);
  });

  it('rejects an empty change, an empty title and unknown fields', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });

    for (const body of [{}, { title: '   ' }, { deletedAt: null }]) {
      expect((await as('u1', 'patch', `/chats/${chat.id}`).send(body)).status).toBe(400);
    }
  });

  it('soft-deletes: the chat is gone from reads, but its data stays', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });

    const deleted = await as('u1', 'delete', `/chats/${chat.id}`);

    expect(deleted.status).toBe(204);
    expect((await as('u1', 'get', `/chats/${chat.id}`)).status).toBe(404);
    expect((await as('u1', 'get', '/chats')).body.items).toEqual([]);
    expect(await ConversationModel.countDocuments({ _id: chat._id })).toBe(1);
  });
});

describe('another user', () => {
  it("gets the same 404 for someone else's chat as for one that does not exist (SEC-04)", async () => {
    const chat = await ConversationModel.create({ userId: 'u1', title: 'Private' });
    const missing = new mongoose.Types.ObjectId().toString();

    for (const id of [chat.id, missing, 'not-an-id']) {
      const responses = await Promise.all([
        as('u2', 'get', `/chats/${id}`),
        as('u2', 'patch', `/chats/${id}`).send({ title: 'Mine now' }),
        as('u2', 'delete', `/chats/${id}`),
        as('u2', 'get', `/chats/${id}/messages`),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body.detail).toBe('No such chat');
      }
    }
    const untouched = await ConversationModel.findById(chat._id);
    expect(untouched?.title).toBe('Private');
    expect(untouched?.deletedAt).toBeNull();
  });
});

describe('GET /chats/:id/messages', () => {
  it('pages from the newest back, each page oldest first, without replaced messages', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const start = minutesAgo(10).getTime();
    const messages = await MessageModel.create(
      Array.from({ length: 5 }, (_, index) => ({
        conversationId: chat._id,
        userId: 'u1',
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `m${index}`,
        createdAt: new Date(start + index * 1000),
      })),
    );
    await MessageModel.updateOne({ _id: messages[1]?._id }, { supersededBy: messages[2]?._id });

    const first = await as('u1', 'get', `/chats/${chat.id}/messages?limit=2`);
    const second = await as(
      'u1',
      'get',
      `/chats/${chat.id}/messages?limit=2&cursor=${first.body.nextCursor}`,
    );

    const contents = (body: { items: { content: string }[] }) =>
      body.items.map((message) => message.content);
    expect(contents(first.body)).toEqual(['m3', 'm4']);
    expect(contents(second.body)).toEqual(['m0', 'm2']);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe('cursors', () => {
  it('round-trips and rejects anything malformed', () => {
    const cursor = { at: new Date().toISOString(), id: new mongoose.Types.ObjectId().toString() };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor(undefined)).toBeUndefined();
    expect(() => decodeCursor('not json')).toThrow('The cursor is not valid');
    expect(() => decodeCursor(encodeCursor({ at: cursor.at, id: 'x' }))).toThrow();
  });
});

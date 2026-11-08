import {
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { ConversationModel, MessageModel } from './models.ts';

const logger = createLogger({ service: 'chat', level: 'silent' });
let mongo: TestMongo;
let privateKey: InternalKey;
let publicKey: InternalKey;
let agentKey: InternalKey;
let agentPublicKey: InternalKey;

beforeAll(async () => {
  mongo = await startTestMongo();
  await Promise.all([ConversationModel.init(), MessageModel.init()]);
  const pair = await generateInternalKeyPair();
  privateKey = await importInternalPrivateKey(pair.privateKey);
  publicKey = await importInternalPublicKey(pair.publicKey);
  const agentPair = await generateInternalKeyPair();
  agentKey = await importInternalPrivateKey(agentPair.privateKey);
  agentPublicKey = await importInternalPublicKey(agentPair.publicKey);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ConversationModel.deleteMany({}), MessageModel.deleteMany({})]);
});

const app = () => createApp({ logger, internalPublicKey: publicKey, agentPublicKey });

/** Tokens as the gateway would sign them, fresh for each test (they last 60 seconds). */
let tokens: Record<'u1' | 'u2' | 'none', string>;
beforeEach(async () => {
  const [u1, u2, none] = await Promise.all([
    signInternalToken(agentKey, 'chat', { userId: 'u1' }, 60, 'agent'),
    signInternalToken(agentKey, 'chat', { userId: 'u2' }, 60, 'agent'),
    signInternalToken(agentKey, 'chat', {}, 60, 'agent'),
  ]);
  tokens = { u1, u2, none };
});

/** A request as the gateway would send it for this user. */
function as(userId: 'u1' | 'u2' | null, method: 'get' | 'post' | 'patch', path: string) {
  return request(app())
    [method](path)
    .set(INTERNAL_TOKEN_HEADER, tokens[userId ?? 'none']);
}

describe('POST /internal/messages', () => {
  it('saves a message and moves the chat to the top of the list', async () => {
    const chat = await ConversationModel.create({ userId: 'u1', lastMessageAt: new Date(0) });

    const response = await as('u1', 'post', '/internal/messages').send({
      chatId: chat.id,
      role: 'user',
      content: 'Hello',
      clientMessageId: 'c-1',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      created: true,
      message: { role: 'user', content: 'Hello', status: 'complete', clientMessageId: 'c-1' },
    });
    const updated = await ConversationModel.findById(chat._id);
    expect(updated?.lastMessageAt.getTime()).toBeGreaterThan(0);
  });

  it('returns the first copy when the same send is retried, even in parallel', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const send = () =>
      as('u1', 'post', '/internal/messages').send({
        chatId: chat.id,
        role: 'user',
        content: 'Once',
        clientMessageId: 'c-1',
      });

    const responses = await Promise.all([send(), send(), send()]);

    const ids = new Set(responses.map((response) => response.body.message.id));
    expect(ids.size).toBe(1);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 201]);
    expect(await MessageModel.countDocuments({ conversationId: chat._id })).toBe(1);
  });

  it('hides the messages it replaces', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const old = await MessageModel.create({
      conversationId: chat._id,
      userId: 'u1',
      role: 'assistant',
      content: 'first answer',
    });

    const response = await as('u1', 'post', '/internal/messages').send({
      chatId: chat.id,
      role: 'assistant',
      content: 'second answer',
      agent: 'chat',
      supersedes: [old.id, 'junk'],
    });

    expect(response.status).toBe(201);
    const replaced = await MessageModel.findById(old._id);
    expect(replaced?.supersededBy?.toString()).toBe(response.body.message.id);
  });

  it("refuses another user's chat and bad input", async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });

    const theirs = await as('u2', 'post', '/internal/messages').send({
      chatId: chat.id,
      role: 'user',
    });
    const badRole = await as('u1', 'post', '/internal/messages').send({
      chatId: chat.id,
      role: 'system',
    });
    const noUser = await as(null, 'post', '/internal/messages').send({
      chatId: chat.id,
      role: 'user',
    });

    expect(theirs.status).toBe(404);
    expect(badRole.status).toBe(400);
    expect(noUser.status).toBe(401);
  });
});

describe('PATCH /internal/messages/:id', () => {
  it("fills in an answer, but never another user's", async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const answer = await MessageModel.create({
      conversationId: chat._id,
      userId: 'u1',
      role: 'assistant',
      status: 'streaming',
    });

    const theirs = await as('u2', 'patch', `/internal/messages/${answer.id}`).send({
      content: 'x',
    });
    const done = await as('u1', 'patch', `/internal/messages/${answer.id}`).send({
      content: 'Full answer',
      status: 'complete',
      sources: [{ url: 'https://example.com', title: 'Example' }],
    });

    expect(theirs.status).toBe(404);
    expect(done.status).toBe(200);
    expect(done.body.message).toMatchObject({
      content: 'Full answer',
      status: 'complete',
      sources: [{ url: 'https://example.com', title: 'Example' }],
    });
  });

  it('rejects an empty change and fields it does not own', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const answer = await MessageModel.create({
      conversationId: chat._id,
      userId: 'u1',
      role: 'assistant',
    });

    for (const body of [{}, { userId: 'u2' }, { role: 'user' }]) {
      expect((await as('u1', 'patch', `/internal/messages/${answer.id}`).send(body)).status).toBe(
        400,
      );
    }
  });
});

describe('GET /internal/chats/:id/recent-messages', () => {
  it('returns the latest finished messages, oldest first', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const start = Date.now() - 60_000;
    await MessageModel.create(
      (['complete', 'complete', 'failed', 'stopped', 'complete', 'streaming'] as const).map(
        (status, index) => ({
          conversationId: chat._id,
          userId: 'u1',
          role: 'assistant' as const,
          content: `m${index}`,
          status,
          createdAt: new Date(start + index * 1000),
        }),
      ),
    );

    const response = await as('u1', 'get', `/internal/chats/${chat.id}/recent-messages?limit=3`);

    expect(response.body.items.map((message: { content: string }) => message.content)).toEqual([
      'm1',
      'm3',
      'm4',
    ]);
    expect((await as('u2', 'get', `/internal/chats/${chat.id}/recent-messages`)).status).toBe(404);
  });
});

describe('/internal/chats/:id', () => {
  it('reads an owned chat and auto-titles it only while it has the default title', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });

    const read = await as('u1', 'get', `/internal/chats/${chat.id}`);
    const first = await as('u1', 'patch', `/internal/chats/${chat.id}`).send({ title: 'Goa trip' });
    const second = await as('u1', 'patch', `/internal/chats/${chat.id}`).send({ title: 'Other' });

    expect(read.body.chat.title).toBe('New chat');
    expect(first.body).toMatchObject({ renamed: true, chat: { title: 'Goa trip' } });
    expect(second.body).toMatchObject({ renamed: false, chat: { title: 'Goa trip' } });
    expect((await as('u2', 'get', `/internal/chats/${chat.id}`)).status).toBe(404);
  });
});

describe('who may call', () => {
  it("refuses the gateway's token on internal routes: only the agent may use them", async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const fromGateway = await signInternalToken(privateKey, 'chat', { userId: 'u1' });

    const response = await request(app())
      .get(`/internal/chats/${chat.id}`)
      .set(INTERNAL_TOKEN_HEADER, fromGateway);

    expect(response.status).toBe(403);
  });
});

describe('GET /internal/chats/:id/last-turn', () => {
  it('returns the latest user message and its answer, of any status, skipping replaced ones', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });
    const start = Date.now() - 60_000;
    const at = (seconds: number) => new Date(start + seconds * 1000);
    const [, , lastUser, oldAnswer, newAnswer] = await MessageModel.create([
      { conversationId: chat._id, userId: 'u1', role: 'user', content: 'q1', createdAt: at(1) },
      {
        conversationId: chat._id,
        userId: 'u1',
        role: 'assistant',
        content: 'a1',
        createdAt: at(2),
      },
      { conversationId: chat._id, userId: 'u1', role: 'user', content: 'q2', createdAt: at(3) },
      {
        conversationId: chat._id,
        userId: 'u1',
        role: 'assistant',
        content: 'a2 old',
        status: 'failed',
        createdAt: at(4),
      },
      {
        conversationId: chat._id,
        userId: 'u1',
        role: 'assistant',
        content: 'a2 new',
        status: 'failed',
        createdAt: at(5),
      },
    ]);
    await MessageModel.updateOne({ _id: oldAnswer?._id }, { supersededBy: newAnswer?._id });

    const response = await as('u1', 'get', `/internal/chats/${chat.id}/last-turn`);

    expect(response.body).toMatchObject({
      user: { id: lastUser?.id, content: 'q2' },
      answer: { id: newAnswer?.id, content: 'a2 new', status: 'failed' },
    });
    expect((await as('u2', 'get', `/internal/chats/${chat.id}/last-turn`)).status).toBe(404);
  });

  it('has no answer while the latest message is unanswered, and nothing in an empty chat', async () => {
    const empty = await ConversationModel.create({ userId: 'u1' });
    const chat = await ConversationModel.create({ userId: 'u1' });
    await MessageModel.create({
      conversationId: chat._id,
      userId: 'u1',
      role: 'user',
      content: 'q',
    });

    expect((await as('u1', 'get', `/internal/chats/${empty.id}/last-turn`)).body).toEqual({
      user: null,
      answer: null,
    });
    expect((await as('u1', 'get', `/internal/chats/${chat.id}/last-turn`)).body).toMatchObject({
      user: { content: 'q' },
      answer: null,
    });
  });
});

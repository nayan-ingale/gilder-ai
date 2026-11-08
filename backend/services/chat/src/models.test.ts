import { mongoose } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ConversationModel,
  findOwnedConversation,
  MessageModel,
  toChat,
  toMessage,
} from './models.ts';

let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo();
  await Promise.all([ConversationModel.init(), MessageModel.init()]);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ConversationModel.deleteMany({}), MessageModel.deleteMany({})]);
});

describe('ConversationModel', () => {
  it('starts as an unpinned "New chat" with a last-message time', async () => {
    const chat = await ConversationModel.create({ userId: 'u1' });

    expect(toChat(chat)).toMatchObject({ title: 'New chat', pinned: false });
    expect(chat.lastMessageAt).toBeInstanceOf(Date);
    expect(chat.deletedAt).toBeNull();
  });

  it('finds titles by text search within one user only', async () => {
    await ConversationModel.create([
      { userId: 'u1', title: 'Trip to Goa' },
      { userId: 'u1', title: 'Tax questions' },
      { userId: 'u2', title: 'Goa beaches' },
    ]);

    const found = await ConversationModel.find({ userId: 'u1', $text: { $search: 'goa' } });

    expect(found.map((chat) => chat.title)).toEqual(['Trip to Goa']);
  });
});

describe('MessageModel', () => {
  it('saves a message once per client ID within a chat', async () => {
    const chatId = new mongoose.Types.ObjectId();
    const message = {
      conversationId: chatId,
      userId: 'u1',
      role: 'user',
      content: 'hi',
      clientMessageId: 'c-1',
    } as const;
    await MessageModel.create(message);

    await expect(MessageModel.create(message)).rejects.toMatchObject({ code: 11000 });
    // Messages without a client ID, such as answers, are not limited.
    await MessageModel.create([
      { conversationId: chatId, userId: 'u1', role: 'assistant', content: 'a' },
      { conversationId: chatId, userId: 'u1', role: 'assistant', content: 'b' },
    ]);
    expect(await MessageModel.countDocuments({ conversationId: chatId })).toBe(3);
  });

  it('accepts only the known roles, statuses and agents', async () => {
    const base = { conversationId: new mongoose.Types.ObjectId(), userId: 'u1' };
    for (const bad of [
      { role: 'system' },
      { role: 'user', status: 'done' },
      { role: 'assistant', agent: 'robot' },
    ]) {
      // Untyped on purpose: these values come from outside the type system.
      await expect(
        MessageModel.create({ ...base, ...bad } as Record<string, unknown>),
      ).rejects.toThrow(mongoose.Error.ValidationError);
    }
  });

  it('shows a message with nulls for what is not set', async () => {
    const message = await MessageModel.create({
      conversationId: new mongoose.Types.ObjectId(),
      userId: 'u1',
      role: 'user',
      content: 'hello',
    });

    expect(toMessage(message)).toMatchObject({
      role: 'user',
      content: 'hello',
      agent: null,
      status: 'complete',
      clientMessageId: null,
      attachments: [],
    });
  });
});

describe('findOwnedConversation', () => {
  it("finds the user's own chat, and nothing for someone else's, a deleted one or a bad ID", async () => {
    const mine = await ConversationModel.create({ userId: 'u1' });
    const deleted = await ConversationModel.create({ userId: 'u1', deletedAt: new Date() });

    expect((await findOwnedConversation('u1', mine.id))?.id).toBe(mine.id);
    expect(await findOwnedConversation('u2', mine.id)).toBeNull();
    expect(await findOwnedConversation('u1', deleted.id)).toBeNull();
    expect(await findOwnedConversation('u1', 'not-an-id')).toBeNull();
  });
});

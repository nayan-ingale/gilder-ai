import { AGENTS, AppError, mongoose, requireUser, validate, z } from '@gilder/shared';
import { Router } from 'express';
import {
  DEFAULT_CHAT_TITLE,
  findOwnedConversation,
  MESSAGE_ROLES,
  MESSAGE_STATUSES,
  MessageModel,
  toChat,
  toMessage,
} from './models.ts';

/**
 * Routes for the agent service, never forwarded by the gateway (it has no /internal routes). They
 * still act for one user: the token names the user, and every lookup filters by them.
 */

const MAX_CONTENT = 100_000;
const MAX_RECENT = 50;

const id = z.string().min(1).max(64);
const idParams = z.object({ id });
const fileIds = z.array(id).max(10);
/** Agent output such as code files, web sources and page citations; shaped by each agent. */
const records = z.array(z.record(z.string(), z.unknown())).max(50);

const createMessageBody = z
  .object({
    chatId: id,
    role: z.enum(MESSAGE_ROLES),
    content: z.string().max(MAX_CONTENT).default(''),
    agent: z.enum(AGENTS).optional(),
    status: z.enum(MESSAGE_STATUSES).default('complete'),
    clientMessageId: id.optional(),
    attachments: fileIds.default([]),
    fileRefs: fileIds.default([]),
    /** Messages this one replaces (an edit or a regenerate); they are hidden from then on. */
    supersedes: z.array(id).max(200).default([]),
  })
  .strict();

const updateMessageBody = z
  .object({
    content: z.string().max(MAX_CONTENT).optional(),
    status: z.enum(MESSAGE_STATUSES).optional(),
    agent: z.enum(AGENTS).optional(),
    attachments: fileIds.optional(),
    artifacts: records.optional(),
    sources: records.optional(),
    citations: records.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Give at least one field');

const autoTitleBody = z.object({ title: z.string().trim().min(1).max(120) }).strict();
const recentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_RECENT).default(20),
});

const chatNotFound = () => new AppError('not_found', 'No such chat');
const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

export function internalRouter(): Router {
  const router = Router();
  router.use('/internal', requireUser());

  router.get('/internal/chats/:id', validate({ params: idParams }), async (req, res) => {
    const userId = res.locals.userId as string;
    const chat = await findOwnedConversation(userId, (req.params as z.output<typeof idParams>).id);
    if (!chat) {
      throw chatNotFound();
    }
    res.json({ chat: toChat(chat) });
  });

  // Auto-title after the first answer. A title the user chose is never overwritten.
  router.patch(
    '/internal/chats/:id',
    validate({ params: idParams, body: autoTitleBody }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const chat = await findOwnedConversation(
        userId,
        (req.params as z.output<typeof idParams>).id,
      );
      if (!chat) {
        throw chatNotFound();
      }
      const renamed = chat.title === DEFAULT_CHAT_TITLE;
      if (renamed) {
        chat.title = (req.body as z.output<typeof autoTitleBody>).title;
        await chat.save();
      }
      res.json({ chat: toChat(chat), renamed });
    },
  );

  // The latest finished messages, oldest first: the memory an agent reads before answering.
  router.get(
    '/internal/chats/:id/recent-messages',
    validate({ params: idParams, query: recentQuery }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const chat = await findOwnedConversation(
        userId,
        (req.params as z.output<typeof idParams>).id,
      );
      if (!chat) {
        throw chatNotFound();
      }
      const { limit } = req.query as unknown as z.output<typeof recentQuery>;
      const messages = await MessageModel.find({
        conversationId: chat._id,
        supersededBy: null,
        status: { $in: ['complete', 'stopped'] },
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit);
      res.json({ items: messages.reverse().map(toMessage) });
    },
  );

  // Save a message. A retried send with the same client ID returns the first copy (200, not 201).
  router.post('/internal/messages', validate({ body: createMessageBody }), async (req, res) => {
    const userId = res.locals.userId as string;
    const { chatId, supersedes, ...fields } = req.body as z.output<typeof createMessageBody>;
    const chat = await findOwnedConversation(userId, chatId);
    if (!chat) {
      throw chatNotFound();
    }

    const findExisting = () =>
      fields.clientMessageId
        ? MessageModel.findOne({
            conversationId: chat._id,
            clientMessageId: fields.clientMessageId,
          })
        : null;
    const existing = await findExisting();
    if (existing) {
      res.json({ message: toMessage(existing), created: false });
      return;
    }

    let message;
    try {
      message = await MessageModel.create({ ...fields, conversationId: chat._id, userId });
    } catch (error) {
      // Two copies of one send raced past the check above; the unique index kept only one.
      const winner = isDuplicateKey(error) ? await findExisting() : null;
      if (!winner) {
        throw error;
      }
      res.json({ message: toMessage(winner), created: false });
      return;
    }

    const replaced = supersedes.filter((value) => mongoose.isValidObjectId(value));
    if (replaced.length > 0) {
      await MessageModel.updateMany(
        { _id: { $in: replaced }, conversationId: chat._id, supersededBy: null },
        { supersededBy: message._id },
      );
    }
    chat.lastMessageAt = message.createdAt;
    await chat.save();
    res.status(201).json({ message: toMessage(message), created: true });
  });

  // Fill in an answer as it finishes: final text, status and whatever the agent produced.
  router.patch(
    '/internal/messages/:id',
    validate({ params: idParams, body: updateMessageBody }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const messageId = (req.params as z.output<typeof idParams>).id;
      const message = mongoose.isValidObjectId(messageId)
        ? await MessageModel.findOne({ _id: messageId, userId })
        : null;
      if (!message) {
        throw new AppError('not_found', 'No such message');
      }
      message.set(req.body as z.output<typeof updateMessageBody>);
      await message.save();
      if (message.status !== 'streaming') {
        const chat = await findOwnedConversation(userId, message.conversationId.toString());
        if (chat) {
          chat.lastMessageAt = new Date();
          await chat.save();
        }
      }
      res.json({ message: toMessage(message) });
    },
  );

  return router;
}

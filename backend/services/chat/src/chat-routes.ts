import { AppError, mongoose, requireUser, validate, z } from '@gilder/shared';
import { type Response, Router } from 'express';
import {
  ConversationModel,
  findOwnedConversation,
  MessageModel,
  type ConversationDocument,
  toChat,
  toMessage,
} from './models.ts';

/**
 * The signed-in user's chats: list, search, create, rename, pin, delete and read history. Every
 * route acts for the user in the internal token. A chat that isn't theirs gets the same 404 as one
 * that doesn't exist, so IDs can't be probed.
 */

const PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

const idParams = z.object({ id: z.string().min(1).max(64) });
const listQuery = z.object({
  query: z.string().trim().max(100).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
});
const createBody = z.object({ title: z.string().trim().min(1).max(120).optional() }).strict();
const updateBody = z
  .object({ title: z.string().trim().min(1).max(120).optional(), pinned: z.boolean().optional() })
  .strict()
  .refine(
    (body) => body.title !== undefined || body.pinned !== undefined,
    'Give a title or pinned',
  );
const historyQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
});

/** A page position: the sort value and ID of the last item, so the next page starts after it. */
interface Cursor {
  at: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(value: string | undefined): Cursor | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'at' in parsed &&
      'id' in parsed &&
      typeof parsed.at === 'string' &&
      typeof parsed.id === 'string' &&
      mongoose.isValidObjectId(parsed.id) &&
      !Number.isNaN(Date.parse(parsed.at))
    ) {
      return { at: parsed.at, id: parsed.id };
    }
  } catch {
    // Falls through to the error below.
  }
  throw new AppError('bad_request', 'The cursor is not valid');
}

const notFound = () => new AppError('not_found', 'No such chat');

async function ownedOr404(res: Response, id: string): Promise<ConversationDocument> {
  const chat = await findOwnedConversation(res.locals.userId as string, id);
  if (!chat) {
    throw notFound();
  }
  return chat;
}

export function chatRouter(): Router {
  const router = Router();
  router.use('/chats', requireUser());

  // The chat list: on the first page every pinned chat, then the rest by latest activity.
  router.get('/chats', validate({ query: listQuery }), async (req, res) => {
    const userId = res.locals.userId as string;
    const { query, cursor, limit } = req.query as unknown as z.output<typeof listQuery>;

    if (query) {
      // Search titles, and the text of the user's messages, then show the matching chats.
      const [byTitle, messageChatIds] = await Promise.all([
        ConversationModel.find({ userId, deletedAt: null, $text: { $search: query } }).limit(
          MAX_PAGE_SIZE,
        ),
        MessageModel.distinct('conversationId', {
          userId,
          supersededBy: null,
          $text: { $search: query },
        }),
      ]);
      const byMessage = await ConversationModel.find({
        _id: { $in: messageChatIds.slice(0, MAX_PAGE_SIZE) },
        userId,
        deletedAt: null,
      });
      const unique = new Map([...byTitle, ...byMessage].map((chat) => [chat.id, chat]));
      const items = [...unique.values()]
        .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
        .slice(0, limit);
      res.json({ items: items.map(toChat), nextCursor: null });
      return;
    }

    const after = decodeCursor(cursor);
    const pinned = after
      ? []
      : await ConversationModel.find({ userId, deletedAt: null, pinnedAt: { $ne: null } })
          .sort({ pinnedAt: -1 })
          .limit(MAX_PAGE_SIZE);
    const unpinned = await ConversationModel.find({
      userId,
      deletedAt: null,
      pinnedAt: null,
      ...(after
        ? {
            $or: [
              { lastMessageAt: { $lt: new Date(after.at) } },
              { lastMessageAt: new Date(after.at), _id: { $lt: after.id } },
            ],
          }
        : {}),
    })
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(limit + 1);

    const page = unpinned.slice(0, limit);
    const last = page.at(-1);
    res.json({
      items: [...pinned, ...page].map(toChat),
      nextCursor:
        unpinned.length > limit && last
          ? encodeCursor({ at: last.lastMessageAt.toISOString(), id: last.id })
          : null,
    });
  });

  router.post('/chats', validate({ body: createBody }), async (req, res) => {
    const { title } = req.body as z.output<typeof createBody>;
    const chat = await ConversationModel.create({
      userId: res.locals.userId as string,
      ...(title ? { title } : {}),
    });
    res.status(201).json({ chat: toChat(chat) });
  });

  router.get('/chats/:id', validate({ params: idParams }), async (req, res) => {
    const chat = await ownedOr404(res, (req.params as z.output<typeof idParams>).id);
    res.json({ chat: toChat(chat) });
  });

  router.patch('/chats/:id', validate({ params: idParams, body: updateBody }), async (req, res) => {
    const chat = await ownedOr404(res, (req.params as z.output<typeof idParams>).id);
    const { title, pinned } = req.body as z.output<typeof updateBody>;
    if (title !== undefined) {
      chat.title = title;
    }
    if (pinned !== undefined) {
      chat.pinnedAt = pinned ? (chat.pinnedAt ?? new Date()) : null;
    }
    await chat.save();
    res.json({ chat: toChat(chat) });
  });

  // Soft delete: the chat leaves every list and query at once.
  router.delete('/chats/:id', validate({ params: idParams }), async (req, res) => {
    const chat = await ownedOr404(res, (req.params as z.output<typeof idParams>).id);
    chat.deletedAt = new Date();
    await chat.save();
    res.status(204).end();
  });

  // History, newest first in pages, each page returned oldest first for display.
  router.get(
    '/chats/:id/messages',
    validate({ params: idParams, query: historyQuery }),
    async (req, res) => {
      const chat = await ownedOr404(res, (req.params as z.output<typeof idParams>).id);
      const { cursor, limit } = req.query as unknown as z.output<typeof historyQuery>;
      const before = decodeCursor(cursor);
      const messages = await MessageModel.find({
        conversationId: chat._id,
        supersededBy: null,
        ...(before
          ? {
              $or: [
                { createdAt: { $lt: new Date(before.at) } },
                { createdAt: new Date(before.at), _id: { $lt: before.id } },
              ],
            }
          : {}),
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);

      const page = messages.slice(0, limit);
      const oldest = page.at(-1);
      res.json({
        items: page.reverse().map(toMessage),
        nextCursor:
          messages.length > limit && oldest
            ? encodeCursor({ at: oldest.createdAt.toISOString(), id: oldest.id })
            : null,
      });
    },
  );

  return router;
}

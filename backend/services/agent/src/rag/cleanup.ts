import type { Logger } from '@gilder/shared';
import type { FileStore } from '../files/file-store.ts';
import { DocumentModel, FileModel } from '../files/models.ts';
import type { ChatService } from '../services.ts';
import type { VectorStore } from './vector-store.ts';

/**
 * Files belong to their chat: when a chat is deleted, its uploads, generated files and indexed
 * PDF pieces go too. Every few minutes the agent asks chat which of its files' chats are gone,
 * per user, and removes what they left behind.
 */

const EVERY_MS = 10 * 60 * 1000;
const BATCH = 200;

export interface CleanupDeps {
  chat: ChatService;
  store?: FileStore | undefined;
  vectors: VectorStore;
  logger: Logger;
}

/** Removes the files of deleted chats. Returns how many files it removed. */
export async function cleanUpDeletedChats(deps: CleanupDeps): Promise<number> {
  const owners = await FileModel.aggregate<{ _id: string; chatIds: string[] }>([
    { $group: { _id: '$userId', chatIds: { $addToSet: '$chatId' } } },
  ]);
  let removed = 0;
  for (const { _id: userId, chatIds } of owners) {
    for (let start = 0; start < chatIds.length; start += BATCH) {
      const gone = await deps.chat.deletedChats(userId, chatIds.slice(start, start + BATCH));
      if (gone.length === 0) {
        continue;
      }
      const documents = await DocumentModel.find({ userId, chatId: { $in: gone } });
      if (documents.length > 0) {
        await deps.vectors.removeDocuments({
          userId,
          documentIds: documents.map((document) => document.id),
        });
      }
      const files = await FileModel.find({ userId, chatId: { $in: gone } });
      await deps.store?.remove(files.map((file) => file.s3Key));
      await DocumentModel.deleteMany({ userId, chatId: { $in: gone } });
      await FileModel.deleteMany({ userId, chatId: { $in: gone } });
      removed += files.length;
    }
  }
  return removed;
}

/** Runs the clean-up every ten minutes, never two at once. Returns a function that stops it. */
export function startFileCleanup(deps: CleanupDeps, everyMs = EVERY_MS): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) {
      return;
    }
    running = true;
    cleanUpDeletedChats(deps)
      .then((removed) => {
        if (removed > 0) {
          deps.logger.info({ removed }, 'removed the files of deleted chats');
        }
      })
      .catch((error: unknown) =>
        deps.logger.error({ err: error }, 'file clean-up failed; it runs again shortly'),
      )
      .finally(() => {
        running = false;
      });
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}

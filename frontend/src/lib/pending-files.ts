/**
 * Files picked on the new-chat page, waiting for the chat page to upload them. Uploads belong to
 * a chat, so attaching there creates the chat first and hands the files over. File objects can't
 * go in the Redux store, so they wait here, in memory, for the one page that takes them.
 */
const waiting = new Map<string, { files: File[]; draft: string }>();

export function queueFiles(chatId: string, files: File[], draft: string): void {
  waiting.set(chatId, { files, draft });
}

/** What waits for this chat, without taking it (safe to call while rendering). */
export function peekQueuedFiles(chatId: string): { files: File[]; draft: string } | undefined {
  return waiting.get(chatId);
}

/** Takes what waits for this chat, so it is used once. */
export function takeQueuedFiles(chatId: string): { files: File[]; draft: string } | undefined {
  const queued = waiting.get(chatId);
  waiting.delete(chatId);
  return queued;
}

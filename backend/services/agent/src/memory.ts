import type { Redis } from '@gilder/shared';
import type { LlmMessage } from './llm/types.ts';

/**
 * A chat's recent messages, for the model to see the conversation. The last 20 finished
 * messages come from the chat service and are cached in Redis for an hour; after a turn the
 * new messages are appended, and an edit or regenerate drops the cache. What the model gets is
 * trimmed to a character budget, newest first, so a long chat never overflows the context.
 */

export const MEMORY_MESSAGES = 20;
const MEMORY_TTL_SECONDS = 60 * 60;
/** About 6,000 tokens at four characters per token, leaving room for the answer. */
const MEMORY_BUDGET_CHARS = 24_000;

export type MemoryMessage = Pick<LlmMessage, 'content'> & { role: 'user' | 'assistant' };

/** Fetches the latest finished messages from the chat service, oldest first. */
export type FetchRecentMessages = (chatId: string, userId: string) => Promise<MemoryMessage[]>;

const memoryKey = (chatId: string) => `mem:${chatId}`;

export interface Memory {
  load(chatId: string, userId: string): Promise<MemoryMessage[]>;
  /** Adds a finished turn to the cached history, if it is cached. */
  append(chatId: string, messages: MemoryMessage[]): Promise<void>;
  /** Drops the cache, after an edit or regenerate changes earlier history. */
  forget(chatId: string): Promise<void>;
}

/** Keeps the newest messages that fit the budget, in their original order. */
export function trimToBudget(
  messages: readonly MemoryMessage[],
  budget = MEMORY_BUDGET_CHARS,
): MemoryMessage[] {
  const kept: MemoryMessage[] = [];
  let used = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || used + message.content.length > budget) {
      break;
    }
    used += message.content.length;
    kept.unshift(message);
  }
  return kept;
}

export function createMemory(redis: Redis, fetchRecent: FetchRecentMessages): Memory {
  return {
    async load(chatId, userId) {
      const cached = await redis.lrange(memoryKey(chatId), 0, -1);
      if (cached.length > 0) {
        return trimToBudget(cached.map((item) => JSON.parse(item) as MemoryMessage));
      }
      const messages = (await fetchRecent(chatId, userId)).slice(-MEMORY_MESSAGES);
      if (messages.length > 0) {
        await redis
          .multi()
          .del(memoryKey(chatId))
          .rpush(memoryKey(chatId), ...messages.map((message) => JSON.stringify(message)))
          .expire(memoryKey(chatId), MEMORY_TTL_SECONDS)
          .exec();
      }
      return trimToBudget(messages);
    },

    async append(chatId, messages) {
      if (messages.length === 0 || !(await redis.exists(memoryKey(chatId)))) {
        // Not cached: the next load reads the chat service, which already has these messages.
        return;
      }
      await redis
        .multi()
        .rpush(memoryKey(chatId), ...messages.map((message) => JSON.stringify(message)))
        .ltrim(memoryKey(chatId), -MEMORY_MESSAGES, -1)
        .expire(memoryKey(chatId), MEMORY_TTL_SECONDS)
        .exec();
    },

    async forget(chatId) {
      await redis.del(memoryKey(chatId));
    },
  };
}

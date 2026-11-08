import type { Agent, InternalClient } from '@gilder/shared';
import type { MemoryMessage } from './memory.ts';

/**
 * The agent's calls to chat and billing, typed. Each call signs a fresh token with the agent's
 * own key for the user it acts for (see createInternalClient), so a long answer never outlives
 * its token.
 */

export interface ChatInfo {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: string;
  createdAt: string;
}

export interface SavedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent: Agent | null;
  status: 'streaming' | 'complete' | 'stopped' | 'failed';
  clientMessageId: string | null;
  createdAt: string;
}

export interface NewMessage {
  chatId: string;
  role: 'user' | 'assistant';
  content?: string;
  agent?: Agent;
  status?: SavedMessage['status'];
  clientMessageId?: string;
  attachments?: string[];
  supersedes?: string[];
}

export interface MessageUpdate {
  content?: string;
  status?: SavedMessage['status'];
  agent?: Agent;
  artifacts?: Record<string, unknown>[];
  sources?: Record<string, unknown>[];
  citations?: Record<string, unknown>[];
}

/** A finished message from history, with its ID. */
export type HistoryMessage = MemoryMessage & { id: string };

/** The latest user message and the answer after it: what regenerate and edit act on. */
export interface LastTurn {
  user: SavedMessage | null;
  answer: SavedMessage | null;
}

export interface ChatService {
  getChat(userId: string, chatId: string): Promise<ChatInfo>;
  recentMessages(userId: string, chatId: string): Promise<HistoryMessage[]>;
  lastTurn(userId: string, chatId: string): Promise<LastTurn>;
  saveMessage(
    userId: string,
    message: NewMessage,
  ): Promise<{ message: SavedMessage; created: boolean }>;
  updateMessage(userId: string, messageId: string, update: MessageUpdate): Promise<SavedMessage>;
  /** Names a new chat; a title the user chose is kept. */
  autoTitle(userId: string, chatId: string, title: string): Promise<void>;
}

export function chatService(client: InternalClient): ChatService {
  return {
    async getChat(userId, chatId) {
      const { chat } = await client.request<{ chat: ChatInfo }>(
        'GET',
        `/internal/chats/${encodeURIComponent(chatId)}`,
        { userId },
      );
      return chat;
    },
    async recentMessages(userId, chatId) {
      const { items } = await client.request<{ items: SavedMessage[] }>(
        'GET',
        `/internal/chats/${encodeURIComponent(chatId)}/recent-messages`,
        { userId },
      );
      return items.map(({ id, role, content }) => ({ id, role, content }));
    },
    lastTurn(userId, chatId) {
      return client.request<LastTurn>(
        'GET',
        `/internal/chats/${encodeURIComponent(chatId)}/last-turn`,
        {
          userId,
          retry: true,
        },
      );
    },
    async saveMessage(userId, message) {
      // Safe to retry: a message with a client ID is saved once (chat returns the first copy).
      return client.request('POST', '/internal/messages', {
        userId,
        body: message,
        retry: message.clientMessageId !== undefined,
      });
    },
    async updateMessage(userId, messageId, update) {
      const { message } = await client.request<{ message: SavedMessage }>(
        'PATCH',
        `/internal/messages/${encodeURIComponent(messageId)}`,
        { userId, body: update, retry: true },
      );
      return message;
    },
    async autoTitle(userId, chatId, title) {
      await client.request('PATCH', `/internal/chats/${encodeURIComponent(chatId)}`, {
        userId,
        body: { title },
        retry: true,
      });
    },
  };
}

export interface Reservation {
  id: string;
  amount: number;
  agent: Agent;
  status: 'held' | 'committed' | 'released';
}

export interface CreditResult {
  reservation: Reservation;
  balance: number;
}

export interface UsageMetadata {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  chatId?: string;
  messageId?: string;
}

export interface BillingService {
  /** The user's balance now; 0 when they have no account yet. */
  balance(userId: string): Promise<number>;
  /** Holds an answer's credits; a 402 AppError when the user has too few. */
  reserve(userId: string, agent: Agent, idempotencyKey: string): Promise<CreditResult>;
  commit(userId: string, reservationId: string, metadata: UsageMetadata): Promise<CreditResult>;
  release(userId: string, reservationId: string): Promise<CreditResult>;
}

export function billingService(client: InternalClient): BillingService {
  // Every credit call is idempotent (a key, or a reservation's fixed outcome), so all may retry.
  return {
    async balance(userId) {
      const { account } = await client.request<{ account: { balance: number } }>(
        'GET',
        '/account',
        {
          userId,
          retry: true,
        },
      );
      return account.balance;
    },
    reserve: (userId, agent, idempotencyKey) =>
      client.request('POST', '/internal/credits/reserve', {
        userId,
        body: { agent, idempotencyKey },
        retry: true,
      }),
    commit: (userId, reservationId, metadata) =>
      client.request('POST', '/internal/credits/commit', {
        userId,
        body: { reservationId, metadata },
        retry: true,
      }),
    release: (userId, reservationId) =>
      client.request('POST', '/internal/credits/release', {
        userId,
        body: { reservationId },
        retry: true,
      }),
  };
}

import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { ChatMessage, ChatSummary, Page } from '@/lib/chats';
import { gatewayGet } from './gateway-fetch';

export interface ChatWithHistory {
  chat: ChatSummary;
  messages: Page<ChatMessage>;
}

// The service's IDs are ObjectIds; anything else can't be a chat, so skip the round trip.
const CHAT_ID = /^[a-f0-9]{24}$/;

/**
 * A chat and its latest page of messages for the server render of /c/[chatId]. Null when the
 * chat doesn't exist or isn't the user's (the gateway answers 404 for both). No session sends
 * the visitor to /login.
 */
async function loadChatWithHistory(chatId: string): Promise<ChatWithHistory | null> {
  if (!CHAT_ID.test(chatId)) {
    return null;
  }
  const [chatResponse, messagesResponse] = await Promise.all([
    gatewayGet(`/api/chats/${chatId}`),
    gatewayGet(`/api/chats/${chatId}/messages`),
  ]);
  if (!chatResponse || !messagesResponse || chatResponse.status === 401) {
    redirect('/login');
  }
  if (chatResponse.status === 404) {
    return null;
  }
  for (const response of [chatResponse, messagesResponse]) {
    if (!response.ok) {
      throw new Error(`the gateway answered ${response.status} for chat ${chatId}`);
    }
  }
  const { chat } = (await chatResponse.json()) as { chat: ChatSummary };
  const messages = (await messagesResponse.json()) as Page<ChatMessage>;
  return { chat, messages };
}

/** Looked up once per request, so the page and its metadata share one round trip. */
export const getChatWithHistory = cache(loadChatWithHistory);

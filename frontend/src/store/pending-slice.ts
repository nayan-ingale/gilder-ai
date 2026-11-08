import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * A new chat's first message, between the new-chat page (which creates the chat) and the chat
 * page (which sends it once it opens), so the message streams on the chat's own URL.
 */
export interface QueuedMessage {
  chatId: string;
  content: string;
  clientMessageId: string;
  agent?: string;
}

export const pendingSlice = createSlice({
  name: 'pending',
  initialState: {} as Record<string, QueuedMessage>,
  reducers: {
    queueFirstMessage(state, action: PayloadAction<QueuedMessage>) {
      state[action.payload.chatId] = action.payload;
    },
    clearFirstMessage(state, action: PayloadAction<string>) {
      delete state[action.payload];
    },
  },
});

export const { queueFirstMessage, clearFirstMessage } = pendingSlice.actions;

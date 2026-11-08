'use client';

import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { useToast } from '@/components/ui/toast';
import { newClientMessageId } from '@/lib/turns';
import { errorMessage, useCreateChatMutation } from '@/store/api';
import { queueFirstMessage } from '@/store/pending-slice';
import type { AppDispatch } from '@/store/store';
import { Composer } from './composer';

/**
 * The new-chat page's composer. The first message creates the chat, then opens it at its own
 * URL, where the message is sent: no empty chats are ever made.
 */
export function NewChatComposer() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const toast = useToast();
  const [createChat] = useCreateChatMutation();

  async function start(content: string, agent?: string): Promise<boolean> {
    try {
      const { chat } = await createChat({}).unwrap();
      dispatch(
        queueFirstMessage({
          chatId: chat.id,
          content,
          clientMessageId: newClientMessageId(),
          ...(agent ? { agent } : {}),
        }),
      );
      router.push(`/c/${chat.id}`);
      return true;
    } catch (error) {
      const { message, requestId } = errorMessage(error);
      toast({
        title: 'Could not start a chat',
        description: message,
        tone: 'danger',
        ...(requestId ? { requestId } : {}),
      });
      return false;
    }
  }

  return <Composer onSend={start} placeholder="Ask anything" autoFocus />;
}

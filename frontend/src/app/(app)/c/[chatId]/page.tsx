import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ChatThread } from '@/components/chat/chat-thread';
import { Skeleton } from '@/components/ui/skeleton';
import { getChatWithHistory } from '@/server/chats';

// The page already streams at request time (it reads the session), so the title can too.
export async function generateMetadata({ params }: PageProps<'/c/[chatId]'>): Promise<Metadata> {
  const { chatId } = await params;
  const loaded = await getChatWithHistory(chatId);
  return { title: loaded ? loaded.chat.title : 'Chat not found' };
}

/** One chat at its own URL. The history is rendered on the server, so it shows on first paint. */
export default function ChatPage({ params }: PageProps<'/c/[chatId]'>) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatView params={params} />
    </Suspense>
  );
}

async function ChatView({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const loaded = await getChatWithHistory(chatId);
  if (!loaded) {
    notFound();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatThread
        chatId={loaded.chat.id}
        chat={loaded.chat}
        initialMessages={loaded.messages.items}
      />
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-label="Loading the chat">
      <div className="flex min-h-[60px] flex-col justify-center gap-1.5 border-b border-line px-4 sm:px-7">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-7 px-4 py-8 sm:px-7">
        <Skeleton className="h-10 w-2/3 self-end" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-1/2 self-end" />
      </div>
    </div>
  );
}

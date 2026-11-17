import { Suspense } from 'react';
import { Greeting, NewChatComposer } from '@/components/chat/new-chat';
import { getCurrentUser } from '@/server/session';

/** The greeting with the signed-in person's first name. */
async function GreetingForUser() {
  const user = await getCurrentUser();
  return <Greeting name={user?.name ?? null} />;
}

/** A new chat: a greeting, the composer and ways to start. Nothing is created until it's used. */
export default function NewChatPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-12">
      <div className="flex w-full max-w-[780px] flex-col gap-7">
        <div className="flex flex-col gap-2">
          <Suspense fallback={<Greeting name={null} />}>
            <GreetingForUser />
          </Suspense>
          <p className="text-base leading-normal text-fg-muted">
            What are we working on? Pick an agent, or let Auto choose one for you.
          </p>
        </div>
        <NewChatComposer />
        <p className="text-center text-[12.5px] text-fg-subtle">
          GilderAi can make mistakes. Check important facts and sources.
        </p>
      </div>
    </div>
  );
}

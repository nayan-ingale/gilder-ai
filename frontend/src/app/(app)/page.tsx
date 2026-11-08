import { NewChatComposer } from '@/components/chat/new-chat';

/** A new chat: nothing is created until the first message is sent. */
export default function NewChatPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl text-fg">What can I help with?</h1>
        <p className="mt-2 max-w-md text-sm text-fg-muted">
          Chat, search the web, write code, and ask about documents and images.
        </p>
      </div>
      <div className="w-full max-w-2xl">
        <NewChatComposer />
      </div>
    </div>
  );
}

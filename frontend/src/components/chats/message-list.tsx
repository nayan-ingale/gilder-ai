import { cn } from '@/components/ui/cn';
import type { ChatMessage } from '@/lib/chats';

/** The conversation, oldest first: the user's messages on the right, answers on the left. */
export function MessageList({ messages }: { messages: readonly ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-base text-fg">No messages yet</p>
        <p className="max-w-sm text-sm text-fg-muted">Ask anything to start this chat.</p>
      </div>
    );
  }
  return (
    <ol aria-label="Messages" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      {messages.map((message) => (
        <li
          key={message.id}
          className={cn(
            'text-sm leading-relaxed whitespace-pre-wrap text-fg',
            message.role === 'user'
              ? 'max-w-[85%] self-end rounded-lg bg-sunken px-4 py-2.5'
              : 'self-stretch',
          )}
        >
          <span className="sr-only">{message.role === 'user' ? 'You: ' : 'GilderAi: '}</span>
          {message.content}
          {message.status === 'stopped' ? (
            <span className="mt-1 block text-xs text-fg-subtle">Stopped</span>
          ) : null}
          {message.status === 'failed' ? (
            <span className="mt-1 block text-xs text-danger">This answer failed.</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

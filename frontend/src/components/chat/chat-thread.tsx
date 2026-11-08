'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useChatThread } from '@/hooks/use-chat-thread';
import type { ChatMessage } from '@/lib/chats';
import { clearFirstMessage } from '@/store/pending-slice';
import type { AppDispatch, RootState } from '@/store/store';
import { Composer } from './composer';
import { MessageItem } from './message-item';

/** A chat's conversation and its composer. A new chat's first message is sent on arrival. */
export function ChatThread({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
}) {
  const thread = useChatThread(chatId, initialMessages);
  const dispatch = useDispatch<AppDispatch>();
  const queued = useSelector((state: RootState) => state.pending[chatId]);
  const startedQueued = useRef(false);
  const [editing, setEditing] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);

  // The message typed on the new-chat page, sent once this page is open.
  useEffect(() => {
    if (queued && !startedQueued.current) {
      startedQueued.current = true;
      dispatch(clearFirstMessage(chatId));
      void thread.send(queued.content, queued.agent, queued.clientMessageId);
    }
  }, [queued, chatId, dispatch, thread]);

  // Keep the newest text in view while it streams, unless the user scrolled up to read.
  useEffect(() => {
    const scroller = bottom.current?.closest('main');
    if (!scroller) {
      return;
    }
    const onScroll = () => {
      followBottom.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (followBottom.current) {
      bottom.current?.scrollIntoView({ block: 'end' });
    }
  }, [thread.messages]);
  // A new answer (send, regenerate or edit) always brings the bottom back into view.
  useEffect(() => {
    if (thread.running) {
      followBottom.current = true;
      bottom.current?.scrollIntoView({ block: 'end' });
    }
  }, [thread.running]);

  const lastIndex = thread.messages.length - 1;
  const lastUserIndex = thread.messages.findLastIndex((message) => message.role === 'user');
  const lastUser = thread.messages[lastUserIndex];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {thread.messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-base text-fg">No messages yet</p>
          <p className="max-w-sm text-sm text-fg-muted">Ask anything to start this chat.</p>
        </div>
      ) : (
        <ol
          aria-label="Messages"
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8"
        >
          {thread.messages.map((message, index) =>
            editing && index === lastUserIndex ? (
              <li key={message.key}>
                <EditBox
                  initial={message.content}
                  onCancel={() => setEditing(false)}
                  onSave={async (content) => {
                    setEditing(false);
                    const accepted = await thread.edit(content);
                    if (!accepted) {
                      setEditing(true);
                    }
                  }}
                />
              </li>
            ) : (
              <MessageItem
                key={message.key}
                message={message}
                onRegenerate={
                  index === lastIndex &&
                  message.role === 'assistant' &&
                  message.id &&
                  !thread.running
                    ? () => void thread.regenerate()
                    : undefined
                }
                onEdit={
                  index === lastUserIndex && message.id && !thread.running
                    ? () => setEditing(true)
                    : undefined
                }
              />
            ),
          )}
          <div ref={bottom} />
        </ol>
      )}
      <div className="sticky bottom-0 bg-gradient-to-t from-canvas from-70% to-transparent px-4 pt-6 pb-4">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            onSend={thread.send}
            onStop={thread.stop}
            running={thread.running}
            onEditLast={lastUser?.id ? () => setEditing(true) : undefined}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}

function EditBox({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <form
      className="ml-auto flex w-full max-w-[85%] flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) {
          void onSave(text.trim());
        }
      }}
    >
      <label htmlFor="edit-message" className="sr-only">
        Edit your message
      </label>
      <Textarea
        id="edit-message"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!text.trim()}>
          Save and send
        </Button>
      </div>
    </form>
  );
}

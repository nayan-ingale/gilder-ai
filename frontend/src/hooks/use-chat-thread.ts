'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import type { ChatMessage } from '@/lib/chats';
import type { CodeFile } from '@/lib/code-files';
import {
  type Citation,
  type Source,
  newClientMessageId,
  stopTurn,
  streamTurn,
  type ThreadMessage,
  type TurnRequest,
} from '@/lib/turns';
import { api } from '@/store/api';
import type { AppDispatch } from '@/store/store';

/**
 * The messages of one chat, and the answer being written. Sending shows the message at once,
 * then fills in the answer as tokens arrive. A refusal before the stream (no credits, a
 * duplicate) puts the thread back as it was and says why.
 */

export function toThreadMessage(message: ChatMessage): ThreadMessage {
  return {
    key: message.id,
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    agent: message.agent,
    ...(message.sources.length > 0 ? { sources: message.sources as Source[] } : {}),
    ...(filesOf(message) ? { files: filesOf(message) } : {}),
    ...(message.attachments.length > 0 ? { attachments: message.attachments } : {}),
    ...(message.citations.length > 0 ? { citations: message.citations as Citation[] } : {}),
    ...(message.fileRefs?.length ? { generated: message.fileRefs } : {}),
    ...(typeof message.credits === 'number' ? { credits: message.credits } : {}),
    ...(typeof message.latencyMs === 'number' ? { latencyMs: message.latencyMs } : {}),
  };
}

/** The files of a saved code answer: its first artifact's files, if any. */
function filesOf(message: ChatMessage): CodeFile[] | undefined {
  const first = message.artifacts[0] as { files?: CodeFile[] } | undefined;
  return first?.files?.length ? first.files : undefined;
}

interface Running {
  controller: AbortController;
  turnId?: string;
}

export interface ChatThread {
  messages: ThreadMessage[];
  running: boolean;
  send(
    content: string,
    agent?: string,
    clientMessageId?: string,
    attachments?: string[],
  ): Promise<boolean>;
  regenerate(): Promise<void>;
  edit(content: string, agent?: string): Promise<boolean>;
  stop(): void;
}

/** Runs a callback before the next frame is drawn (soon after, where frames don't exist). */
function nextFrame(callback: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
  } else {
    setTimeout(callback, 16);
  }
}

export function useChatThread(chatId: string, initial: ChatMessage[]): ChatThread {
  const dispatch = useDispatch<AppDispatch>();
  const toast = useToast();
  const [messages, setMessages] = useState<ThreadMessage[]>(() => initial.map(toThreadMessage));
  const [running, setRunning] = useState<Running | null>(null);
  const runningRef = useRef<Running | null>(null);

  // Leaving the page ends the stream on this side; the server settles the answer. React's
  // development mode unmounts and remounts once on purpose, so the abort waits a tick and only
  // happens if the thread really went away.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) {
          runningRef.current?.controller.abort();
        }
      }, 0);
    };
  }, []);

  const run = useCallback(
    async (request: TurnRequest, optimistic: (current: ThreadMessage[]) => ThreadMessage[]) => {
      if (runningRef.current) {
        return false;
      }
      const before = messages;
      const answerKey = `answer-${request.clientMessageId}`;
      // When the request left, so a finished answer can say how long it took.
      const startedAt = Date.now();
      const userKey = `user-${request.clientMessageId}`;
      const updateAnswer = (change: (message: ThreadMessage) => ThreadMessage) =>
        setMessages((current) =>
          current.map((message) => (message.key === answerKey ? change(message) : message)),
        );
      // Words that arrive between two frames go into one update, so a fast stream renders at
      // most once per frame instead of once per network chunk. Any other event, and the end of
      // the stream, first adds what is waiting, so the order never changes.
      let waitingText = '';
      let frameRequested = false;
      const addWaitingText = () => {
        if (!waitingText) {
          return;
        }
        const text = waitingText;
        waitingText = '';
        updateAnswer((message) => ({ ...message, content: message.content + text }));
      };
      const addTextNextFrame = (text: string) => {
        waitingText += text;
        if (!frameRequested) {
          frameRequested = true;
          nextFrame(() => {
            frameRequested = false;
            addWaitingText();
          });
        }
      };

      const current: Running = { controller: new AbortController() };
      runningRef.current = current;
      setRunning(current);
      setMessages((existing) => [
        ...optimistic(existing),
        { key: answerKey, role: 'assistant', content: '', status: 'streaming' },
      ]);

      let accepted = false;
      let failed = false;
      try {
        for await (const turnEvent of streamTurn(request, current.controller.signal)) {
          accepted = true;
          if (turnEvent.event !== 'token') {
            addWaitingText();
          }
          switch (turnEvent.event) {
            case 'meta': {
              current.turnId = turnEvent.data.turnId;
              const { userMessageId, assistantMessageId } = turnEvent.data;
              setMessages((existing) =>
                existing.map((message) =>
                  message.key === answerKey
                    ? { ...message, id: assistantMessageId }
                    : message.key === userKey
                      ? { ...message, id: userMessageId }
                      : message,
                ),
              );
              break;
            }
            case 'progress':
              updateAnswer((message) => ({
                ...message,
                progress: turnEvent.data,
                progressSteps: message.progressSteps?.includes(turnEvent.data.step)
                  ? message.progressSteps
                  : [...(message.progressSteps ?? []), turnEvent.data.step],
              }));
              break;
            case 'file':
              updateAnswer((message) => ({
                ...message,
                generated: [...(message.generated ?? []), turnEvent.data.fileId],
              }));
              break;
            case 'citations':
              updateAnswer((message) => ({ ...message, citations: turnEvent.data.items }));
              break;
            case 'artifact':
              updateAnswer((message) => ({ ...message, files: turnEvent.data.files }));
              break;
            case 'sources':
              updateAnswer((message) => ({ ...message, sources: turnEvent.data.items }));
              break;
            case 'agent':
              updateAnswer((message) => ({ ...message, agent: turnEvent.data.agent }));
              break;
            case 'token':
              addTextNextFrame(turnEvent.data.text);
              break;
            case 'usage':
              updateAnswer((message) => ({ ...message, credits: turnEvent.data.creditsCharged }));
              dispatch(
                api.util.updateQueryData('getAccount', undefined, (draft) => {
                  draft.account.balance = turnEvent.data.balance;
                }),
              );
              break;
            case 'title':
              dispatch(
                api.util.updateQueryData('getChat', chatId, (draft) => {
                  draft.chat.title = turnEvent.data.title;
                }),
              );
              break;
            case 'error':
              failed = true;
              updateAnswer((message) => ({
                ...message,
                status: 'failed',
                error: {
                  message: turnEvent.data.message,
                  ...(turnEvent.data.requestId ? { requestId: turnEvent.data.requestId } : {}),
                },
              }));
              toast({
                title: 'The answer failed',
                description: turnEvent.data.message,
                tone: 'danger',
                ...(turnEvent.data.requestId ? { requestId: turnEvent.data.requestId } : {}),
              });
              break;
            case 'done':
              break;
          }
        }
        addWaitingText();
        const stopped = current.controller.signal.aborted;
        if (!failed) {
          updateAnswer((message) => {
            // The file is done: the progress bar goes.
            const finished = {
              ...message,
              status: stopped ? ('stopped' as const) : ('complete' as const),
              ...(stopped ? {} : { latencyMs: Date.now() - startedAt }),
            };
            delete finished.progress;
            return finished;
          });
        }
        return true;
      } catch (error) {
        if (!accepted) {
          // Refused before the stream: nothing was saved or charged, so undo the optimistic view.
          setMessages(before);
        } else {
          addWaitingText();
          updateAnswer((message) => ({ ...message, status: 'failed' }));
        }
        const known = error instanceof ApiError ? error : undefined;
        toast({
          title: known?.status === 402 ? 'Out of credits' : 'Could not send the message',
          description: known?.message ?? 'Something went wrong. Please try again.',
          tone: 'danger',
          ...(known?.requestId ? { requestId: known.requestId } : {}),
        });
        return false;
      } finally {
        runningRef.current = null;
        setRunning(null);
        // The chat moved to the top of the list, maybe with a new title.
        dispatch(
          api.util.invalidateTags([
            { type: 'Chat', id: 'LIST' },
            { type: 'Chat', id: chatId },
            // The answer was charged: the usage page's numbers changed.
            'Usage',
          ]),
        );
      }
    },
    [chatId, dispatch, messages, toast],
  );

  const send = useCallback(
    (
      content: string,
      agent?: string,
      clientMessageId = newClientMessageId(),
      attachments: string[] = [],
    ) =>
      run(
        {
          kind: 'send',
          chatId,
          content,
          clientMessageId,
          ...(agent ? { agent } : {}),
          ...(attachments.length > 0 ? { attachments } : {}),
        },
        (current) => [
          ...current,
          {
            key: `user-${clientMessageId}`,
            role: 'user',
            content,
            status: 'complete',
            ...(attachments.length > 0 ? { attachments } : {}),
          },
        ],
      ),
    [chatId, run],
  );

  const regenerate = useCallback(async () => {
    const last = messages.at(-1);
    if (last?.role !== 'assistant' || !last.id) {
      return;
    }
    const lastId = last.id;
    await run(
      { kind: 'regenerate', chatId, messageId: lastId, clientMessageId: newClientMessageId() },
      (current) => current.filter((message) => message.id !== lastId),
    );
  }, [chatId, messages, run]);

  const edit = useCallback(
    async (content: string, agent?: string) => {
      const lastUser = [...messages].reverse().find((message) => message.role === 'user');
      if (!lastUser?.id) {
        return false;
      }
      const index = messages.indexOf(lastUser);
      const clientMessageId = newClientMessageId();
      return run(
        {
          kind: 'edit',
          chatId,
          messageId: lastUser.id,
          content,
          clientMessageId,
          ...(agent ? { agent } : {}),
        },
        (current) => [
          ...current.slice(0, index),
          { key: `user-${clientMessageId}`, role: 'user', content, status: 'complete' },
        ],
      );
    },
    [chatId, messages, run],
  );

  const stop = useCallback(() => {
    const current = runningRef.current;
    if (!current) {
      return;
    }
    if (current.turnId) {
      void stopTurn(current.turnId);
    }
    current.controller.abort();
  }, []);

  return { messages, running: running !== null, send, regenerate, edit, stop };
}

'use client';

import { Code, FileText, Globe, Presentation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useSyncExternalStore } from 'react';
import { useDispatch } from 'react-redux';
import { useToast } from '@/components/ui/toast';
import { queueFiles } from '@/lib/pending-files';
import { newClientMessageId } from '@/lib/turns';
import { errorMessage, useCreateChatMutation } from '@/store/api';
import { queueFirstMessage } from '@/store/pending-slice';
import type { AppDispatch } from '@/store/store';
import { Composer, type ComposerHandle, creditsLabel } from './composer';

/** Ways to start, each filling the composer with a first line and the right agent. */
const SUGGESTIONS = [
  {
    title: 'Research a topic with sources',
    description: 'Get an answer from the live web, with numbered citations.',
    agent: 'search',
    agentLabel: 'Search',
    cost: 5,
    icon: Globe,
    start: 'What are the latest developments in ',
  },
  {
    title: 'Build a landing page',
    description: 'Working HTML, CSS and JavaScript with a live preview.',
    agent: 'code',
    agentLabel: 'Code',
    cost: 10,
    icon: Code,
    start: 'Build a landing page for ',
  },
  {
    title: 'Turn notes into slides',
    description: 'Paste your notes and get a six-slide deck to download.',
    agent: 'slides',
    agentLabel: 'Slides',
    cost: 10,
    icon: Presentation,
    start: 'Turn these notes into a six-slide deck:\n',
  },
  {
    title: 'Ask questions about a PDF',
    description: 'Attach a document and get answers with page references.',
    agent: null,
    agentLabel: 'PDF Q&A',
    cost: 10,
    icon: FileText,
    start: null,
  },
] as const;

const noSubscription = () => () => {};

function partOfDay(hour: number): string {
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Good evening, Nayan", by the visitor's own clock; the server, which can't know it, says hello. */
export function Greeting({ name }: { name: string | null }) {
  const greeting = useSyncExternalStore(
    noSubscription,
    () => partOfDay(new Date().getHours()),
    () => 'Hello',
  );
  const first = name?.trim().split(/\s+/)[0];
  return (
    <h1 className="text-[32px] leading-[1.15] font-semibold tracking-[-0.02em] text-fg sm:text-[40px]">
      {first ? `${greeting}, ${first}` : greeting}
    </h1>
  );
}

/**
 * The new-chat page's composer and suggestions. The first message creates the chat, then opens
 * it at its own URL, where the message is sent: no empty chats are made by typing. Attaching a
 * file creates the chat at once, since uploads belong to a chat, and hands the files over.
 */
export function NewChatComposer() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const toast = useToast();
  const [createChat] = useCreateChatMutation();
  const composer = useRef<ComposerHandle>(null);

  function failed(error: unknown) {
    const { message, requestId } = errorMessage(error);
    toast({
      title: 'Could not start a chat',
      description: message,
      tone: 'danger',
      ...(requestId ? { requestId } : {}),
    });
  }

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
      failed(error);
      return false;
    }
  }

  async function attach(files: File[], draft: string) {
    try {
      const { chat } = await createChat({}).unwrap();
      queueFiles(chat.id, files, draft);
      router.push(`/c/${chat.id}`);
    } catch (error) {
      failed(error);
    }
  }

  return (
    <>
      <Composer
        ref={composer}
        onSend={start}
        onAttach={(files, draft) => void attach(files, draft)}
        placeholder="Ask anything"
        menuSide="bottom"
        autoFocus
      />
      <ul
        aria-label="Suggestions"
        className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3"
      >
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <li key={suggestion.title} className="flex">
              <button
                type="button"
                onClick={() =>
                  suggestion.start === null
                    ? composer.current?.pickFiles()
                    : composer.current?.fill(suggestion.start, suggestion.agent ?? undefined)
                }
                className="flex w-full items-start gap-3 rounded-md border border-line bg-surface p-4 text-left text-fg hover:border-line-strong hover:bg-sunken"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent-text"
                >
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[14.5px] font-medium">{suggestion.title}</span>
                  <span className="text-[13px] leading-[1.45] text-fg-muted">
                    {suggestion.description}
                  </span>
                  <span className="mt-0.5 text-xs text-fg-subtle">
                    {suggestion.agentLabel} · {creditsLabel(suggestion.cost)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

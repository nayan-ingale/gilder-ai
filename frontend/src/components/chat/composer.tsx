'use client';

import { ArrowUp, ChevronDown, Square } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BUILT_AGENTS } from '@/lib/turns';
import { useGetAccountQuery } from '@/store/api';

/** The agents a user can pick, and the `/` shortcut for each. Only built ones are offered. */
export const AGENT_OPTIONS = [
  { id: 'chat', label: 'Chat', shortcut: null, hint: 'Everyday questions' },
  { id: 'search', label: 'Search', shortcut: '/search', hint: 'Answers from the web' },
  { id: 'code', label: 'Code', shortcut: '/code', hint: 'Write code files' },
  { id: 'pdf', label: 'PDF', shortcut: '/pdf', hint: 'Make a PDF document' },
  { id: 'slides', label: 'Slides', shortcut: '/slides', hint: 'Make a presentation' },
  { id: 'image', label: 'Image', shortcut: '/image', hint: 'Draw an image' },
] as const;

const built = new Set<string>(BUILT_AGENTS);
const OFFERED = AGENT_OPTIONS.filter((option) => built.has(option.id));
const MAX_LENGTH = 20_000;

export interface ComposerProps {
  /** Sends the message; resolves false when it was refused, so the text comes back. */
  onSend: (content: string, agent?: string) => Promise<boolean>;
  onStop?: () => void;
  /** An answer is being written: the send button becomes a stop button. */
  running?: boolean;
  /** ↑ in an empty box edits the latest message. */
  onEditLast?: () => void;
  /** Text to start with, such as a message being edited. */
  initialText?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function Composer({
  onSend,
  onStop,
  running = false,
  onEditLast,
  initialText = '',
  placeholder = 'Ask anything',
  autoFocus = false,
}: ComposerProps) {
  const [text, setText] = useState(initialText);
  const [agent, setAgent] = useState<string | undefined>(undefined);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { data } = useGetAccountQuery();
  const outOfCredits = data !== undefined && data.account.balance < 1;

  // The box grows with its text, up to a limit, then scrolls.
  useEffect(() => {
    const element = textarea.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
    }
  }, [text]);

  useEffect(() => {
    if (autoFocus) {
      textarea.current?.focus();
    }
  }, [autoFocus]);

  // Esc stops the answer from anywhere on the page.
  useEffect(() => {
    if (!running || !onStop) {
      return;
    }
    const stopOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onStop();
      }
    };
    window.addEventListener('keydown', stopOnEscape);
    return () => window.removeEventListener('keydown', stopOnEscape);
  }, [running, onStop]);

  const trimmed = text.trim();
  const canSend = trimmed !== '' && !running && !outOfCredits && trimmed.length <= MAX_LENGTH;
  const shortcutHints =
    /^\/\w*$/.test(text) && !running
      ? OFFERED.filter((option) => option.shortcut?.startsWith(text.toLowerCase()))
      : [];

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) {
      return;
    }
    const content = trimmed;
    setText('');
    const accepted = await onSend(content, agent);
    if (!accepted) {
      setText(content);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'ArrowUp' && text === '' && onEditLast && !running) {
      event.preventDefault();
      onEditLast();
    }
  }

  const agentLabel = OFFERED.find((option) => option.id === agent)?.label ?? 'Auto';

  return (
    <form onSubmit={(event) => void submit(event)} className="relative">
      {shortcutHints.length > 0 ? (
        <ul
          aria-label="Shortcuts"
          className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-line bg-raised p-1 text-sm shadow-lg"
        >
          {shortcutHints.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-surface"
                onClick={() => {
                  setText(`${option.shortcut ?? ''} `);
                  textarea.current?.focus();
                }}
              >
                <span className="font-medium text-fg">{option.shortcut}</span>
                <span className="text-xs text-fg-subtle">{option.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {outOfCredits ? (
        <p role="status" className="mb-2 text-sm text-warning">
          You are out of credits. New answers need credits.
        </p>
      ) : null}
      <div className="rounded-xl border border-line-strong bg-raised p-2 shadow-sm focus-within:border-accent">
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textarea}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={MAX_LENGTH}
          className="block max-h-60 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <div className="mt-1 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-fg-muted hover:bg-surface hover:text-fg"
              aria-label={`Agent: ${agentLabel}`}
            >
              {agentLabel}
              <ChevronDown size={14} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuLabel>Answer with</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setAgent(undefined)}>
                <span className="flex flex-col">
                  <span>Auto</span>
                  <span className="text-xs text-fg-subtle">Picks the best agent</span>
                </span>
              </DropdownMenuItem>
              {OFFERED.map((option) => (
                <DropdownMenuItem key={option.id} onSelect={() => setAgent(option.id)}>
                  <span className="flex flex-col">
                    <span>{option.label}</span>
                    <span className="text-xs text-fg-subtle">{option.hint}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {running ? (
            <IconButton
              label="Stop the answer"
              icon={<Square size={14} fill="currentColor" />}
              size="sm"
              onClick={onStop}
              className="bg-fg text-canvas hover:bg-fg hover:text-canvas hover:opacity-90"
            />
          ) : (
            <IconButton
              type="submit"
              label="Send"
              icon={<ArrowUp size={16} />}
              size="sm"
              disabled={!canSend}
              className={cn(
                canSend &&
                  'bg-accent text-accent-ink hover:bg-accent hover:text-accent-ink hover:opacity-90',
              )}
            />
          )}
        </div>
      </div>
    </form>
  );
}

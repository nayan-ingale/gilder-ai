'use client';

import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  Compass,
  FileText,
  Globe,
  ImageIcon,
  MessageCircle,
  Mic,
  Plus,
  Presentation,
  Square,
  X,
} from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { useToast } from '@/components/ui/toast';
import { useDictation } from '@/hooks/use-dictation';
import { LOW_BALANCE } from '@/lib/billing';
import { BUILT_AGENTS } from '@/lib/turns';
import { ACCEPTED_TYPES } from '@/lib/uploads';
import { useGetAccountQuery } from '@/store/api';

/**
 * The agents a user can pick: what each does, its cost in credits (billing's CREDIT_COSTS) and
 * its `/` shortcut. Only built ones are offered.
 */
export const AGENT_OPTIONS = [
  {
    id: 'chat',
    label: 'Chat',
    shortcut: null,
    hint: 'Conversation, explanations and writing',
    cost: 1,
    icon: MessageCircle,
  },
  {
    id: 'search',
    label: 'Search',
    shortcut: '/search',
    hint: 'Live web answers with sources',
    cost: 5,
    icon: Globe,
  },
  {
    id: 'code',
    label: 'Code',
    shortcut: '/code',
    hint: 'Working projects with a live preview',
    cost: 10,
    icon: Code,
  },
  {
    id: 'pdf',
    label: 'PDF',
    shortcut: '/pdf',
    hint: 'A formatted PDF document to download',
    cost: 10,
    icon: FileText,
  },
  {
    id: 'slides',
    label: 'Slides',
    shortcut: '/slides',
    hint: 'A presentation deck to download',
    cost: 10,
    icon: Presentation,
  },
  {
    id: 'image',
    label: 'Image',
    shortcut: '/image',
    hint: 'An image generated from your prompt',
    cost: 10,
    icon: ImageIcon,
  },
] as const;

const AUTO = {
  id: 'auto',
  label: 'Auto',
  hint: 'Picks the best agent for each message',
  costLabel: '1–10 credits',
  icon: Compass,
};

const built = new Set<string>(BUILT_AGENTS);
const OFFERED = AGENT_OPTIONS.filter((option) => built.has(option.id));
const MAX_LENGTH = 20_000;

/** The label and icon of the agent that wrote an answer, or null for none or an unknown one. */
export function agentInfo(
  agent: string | null | undefined,
): { label: string; icon: (typeof AGENT_OPTIONS)[number]['icon'] } | null {
  const option = AGENT_OPTIONS.find((candidate) => candidate.id === agent);
  if (option) {
    return { label: option.label, icon: option.icon };
  }
  if (agent === 'pdf_qa') {
    return { label: 'PDF Q&A', icon: FileText };
  }
  return agent === 'image_qa' ? { label: 'Image Q&A', icon: ImageIcon } : null;
}

/** What an answer from this agent costs, in credits (10 for the agents only picked automatically). */
export function costOf(agent: string | null | undefined): number {
  return AGENT_OPTIONS.find((option) => option.id === agent)?.cost ?? 10;
}

/** "1 credit" or "10 credits". */
export function creditsLabel(cost: number): string {
  return `${cost} ${cost === 1 ? 'credit' : 'credits'}`;
}

/** A file being attached to the next message. */
export interface PendingAttachment {
  key: string;
  name: string;
  kind: 'pdf' | 'image';
  status: 'uploading' | 'reading' | 'ready' | 'failed';
  fileId?: string;
  sizeBytes?: number;
}

const ATTACHMENT_STATUS: Record<PendingAttachment['status'], string> = {
  uploading: 'Uploading…',
  reading: 'Reading…',
  ready: 'Ready',
  failed: 'Failed',
};

/** 412 KB or 1.2 MB. */
export function fileSize(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1_000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** What a page can do to the composer from outside, such as a suggestion card. */
export interface ComposerHandle {
  /** Puts text in the box (and picks an agent), then focuses it. */
  fill: (text: string, agent?: string) => void;
  /** Opens the file picker. */
  pickFiles: () => void;
}

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
  /** Files attached to the next message; with onAttach, the attach button is shown. */
  attachments?: PendingAttachment[];
  /** Gets the picked files and the text typed so far. */
  onAttach?: (files: File[], draft: string) => void;
  onRemoveAttachment?: (key: string) => void;
  /** Where the agent menu opens: above the box (in a chat) or below it (on the new-chat page). */
  menuSide?: 'top' | 'bottom';
  ref?: Ref<ComposerHandle>;
}

export function Composer({
  onSend,
  onStop,
  running = false,
  onEditLast,
  initialText = '',
  placeholder = 'Ask anything',
  autoFocus = false,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  menuSide = 'top',
  ref,
}: ComposerProps) {
  const filePicker = useRef<HTMLInputElement>(null);
  const attachmentsReady = attachments.every((attachment) => attachment.status === 'ready');
  const [text, setText] = useState(initialText);
  const [agent, setAgent] = useState<string | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const { data } = useGetAccountQuery();
  const balance = data?.account.balance ?? 0;
  const outOfCredits = data !== undefined && balance < 1;
  const lowCredits = data !== undefined && balance < LOW_BALANCE;
  const dictation = useDictation(
    () => textarea.current?.value ?? '',
    (spoken) => setText(spoken.slice(0, MAX_LENGTH)),
    () =>
      toast({
        title: 'The microphone is blocked',
        description: 'Allow microphone access for this site to dictate.',
        tone: 'danger',
      }),
  );

  useImperativeHandle(ref, () => ({
    fill(value, pick) {
      setText(value);
      setAgent(pick);
      requestAnimationFrame(() => {
        const element = textarea.current;
        element?.focus();
        element?.setSelectionRange(value.length, value.length);
      });
    },
    pickFiles() {
      filePicker.current?.click();
    },
  }));

  // The box grows with its text, up to a limit, then scrolls.
  useEffect(() => {
    const element = textarea.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${Math.min(Math.max(element.scrollHeight, 52), 240)}px`;
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
  const canSend =
    trimmed !== '' && !running && !outOfCredits && trimmed.length <= MAX_LENGTH && attachmentsReady;
  const shortcutHints =
    /^\/\w*$/.test(text) && !running
      ? OFFERED.filter((option) => option.shortcut?.startsWith(text.toLowerCase()))
      : [];

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) {
      return;
    }
    if (dictation.listening) {
      dictation.toggle();
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

  const picked = OFFERED.find((option) => option.id === agent);
  const PillIcon = picked?.icon ?? AUTO.icon;
  const pillLabel = picked?.label ?? AUTO.label;
  // With Auto and a file attached, the file decides the agent: say which.
  const pillSub =
    !picked && attachments.length > 0
      ? attachments.some((attachment) => attachment.kind === 'pdf')
        ? 'PDF Q&A'
        : 'Image Q&A'
      : null;
  const ChevronIcon = (menuSide === 'top') === menuOpen ? ChevronDown : ChevronUp;

  return (
    <form onSubmit={(event) => void submit(event)} className="relative">
      {shortcutHints.length > 0 ? (
        <ul
          aria-label="Shortcuts"
          className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-line bg-raised p-1.5 text-sm shadow-raised"
        >
          {shortcutHints.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="flex min-h-[38px] w-full items-center justify-between gap-3 rounded-sm px-2.5 text-left hover:bg-sunken"
                onClick={() => {
                  setText(`${option.shortcut ?? ''} `);
                  textarea.current?.focus();
                }}
              >
                <span className="font-mono text-[13px] text-fg">{option.shortcut}</span>
                <span className="truncate text-xs text-fg-muted">{option.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {lowCredits ? (
        <div
          role="status"
          className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-md border border-line bg-warning-soft py-2.5 pr-2.5 pl-3.5 text-fg"
        >
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" className="text-warning" />
          <span className="flex-[1_1_240px] text-[13.5px]">
            {outOfCredits
              ? 'You are out of credits. New answers need credits.'
              : `${creditsLabel(balance)} left. PDF, Slides and Image need 10 credits each.`}
          </span>
          <Link
            href="/settings/billing"
            className="inline-flex min-h-9 items-center rounded-sm border border-line-strong bg-raised px-3.5 text-[13px] font-medium text-fg hover:bg-sunken"
          >
            Get credits
          </Link>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-raised pt-3 pr-2.5 pb-2.5 pl-3.5 transition-shadow focus-within:border-accent-border focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
        {attachments.length > 0 ? (
          <ul aria-label="Attached files" className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <li
                key={attachment.key}
                className={cn(
                  'flex max-w-72 items-center gap-2.5 rounded-md border py-1.5 pr-1 pl-2',
                  attachment.status === 'failed'
                    ? 'border-danger bg-danger-soft'
                    : 'border-line bg-surface',
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent-text"
                >
                  {attachment.kind === 'pdf' ? (
                    <FileText size={16} strokeWidth={1.75} />
                  ) : (
                    <ImageIcon size={16} strokeWidth={1.75} />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium text-fg">
                    {attachment.name}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      attachment.status === 'failed' ? 'text-danger' : 'text-fg-muted',
                    )}
                  >
                    {[
                      attachment.kind === 'pdf' ? 'PDF' : 'Image',
                      attachment.sizeBytes ? fileSize(attachment.sizeBytes) : null,
                      ATTACHMENT_STATUS[attachment.status],
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {onRemoveAttachment ? (
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() => onRemoveAttachment(attachment.key)}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-sunken hover:text-fg"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textarea}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={MAX_LENGTH}
          className="block max-h-60 min-h-[52px] w-full resize-none bg-transparent px-0.5 py-1 text-base leading-normal text-fg outline-none placeholder:text-fg-subtle sm:text-[15px]"
        />
        <div className="flex items-center gap-1.5">
          {onAttach ? (
            <>
              <button
                type="button"
                aria-label="Attach a PDF or image"
                title="Attach a PDF or image"
                disabled={running}
                onClick={() => filePicker.current?.click()}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line text-fg-muted pointer-coarse:size-11 hover:bg-sunken hover:text-fg disabled:opacity-50"
              >
                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <input
                ref={filePicker}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                multiple
                hidden
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  event.target.value = '';
                  if (files.length > 0) {
                    onAttach(files, text);
                  }
                }}
              />
            </>
          ) : null}
          <span className="ml-1 hidden min-w-0 truncate text-xs text-fg-subtle sm:inline">
            Type <Kbd className="h-4 text-fg-subtle">/</Kbd> to switch agents
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                aria-label={`Agent: ${pillLabel}`}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-md border pr-2 pl-2.5 text-[13.5px] font-medium whitespace-nowrap pointer-coarse:min-h-11',
                  picked
                    ? 'border-accent-border bg-accent-soft text-accent-text'
                    : 'border-transparent text-fg hover:bg-sunken data-[state=open]:bg-sunken',
                )}
              >
                <PillIcon size={15} strokeWidth={1.75} aria-hidden="true" />
                {pillLabel}
                {pillSub ? <span className="font-normal text-fg-muted">· {pillSub}</span> : null}
                <ChevronIcon size={14} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={menuSide}
                align="end"
                collisionPadding={8}
                className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[344px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg"
              >
                <DropdownMenuLabel className="font-medium">Agent</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={agent ?? AUTO.id}
                  onValueChange={(value) => {
                    setAgent(value === AUTO.id ? undefined : value);
                    setMenuOpen(false);
                    textarea.current?.focus();
                  }}
                >
                  {[
                    { ...AUTO, costLabel: AUTO.costLabel },
                    ...OFFERED.map((option) => ({
                      ...option,
                      costLabel: creditsLabel(option.cost),
                    })),
                  ].map((option) => {
                    const on = (agent ?? AUTO.id) === option.id;
                    const Icon = option.icon;
                    return (
                      <DropdownMenuRadioItem
                        key={option.id}
                        value={option.id}
                        className="flex min-h-[52px] items-center gap-3 rounded-md px-2.5 py-2 data-[highlighted]:bg-sunken data-[state=checked]:bg-sunken"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-sm',
                            on ? 'bg-accent-soft text-accent-text' : 'bg-sunken text-fg-muted',
                          )}
                        >
                          <Icon size={16} strokeWidth={1.75} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                          <span className="text-sm font-medium text-fg">{option.label}</span>
                          <span className="text-[12.5px] text-fg-muted">{option.hint}</span>
                        </span>
                        <span className="text-xs whitespace-nowrap text-fg-subtle tabular-nums">
                          {option.costLabel}
                        </span>
                        <span aria-hidden="true" className="flex w-4 shrink-0 justify-center">
                          {on ? <Check size={16} className="text-accent-text" /> : null}
                        </span>
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <p className="px-2.5 pt-1 pb-1.5 text-xs leading-normal text-fg-muted">
                  Shortcut: start a message with{' '}
                  <code className="rounded-sm bg-sunken px-1 font-mono text-[11.5px]">/search</code>
                  , <code className="rounded-sm bg-sunken px-1 font-mono text-[11.5px]">/code</code>{' '}
                  or <code className="rounded-sm bg-sunken px-1 font-mono text-[11.5px]">/pdf</code>
                  .
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
            {dictation.supported ? (
              <button
                type="button"
                onClick={dictation.toggle}
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? 'Stop dictating' : 'Dictate a message'}
                title={dictation.listening ? 'Stop dictating' : 'Dictate a message'}
                disabled={running}
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-full disabled:opacity-50 pointer-coarse:size-11',
                  dictation.listening
                    ? 'bg-danger-soft text-danger'
                    : 'text-fg-muted hover:bg-sunken hover:text-fg',
                )}
              >
                <Mic size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : null}
            {running ? (
              <button
                type="button"
                aria-label="Stop the answer"
                title="Stop the answer (Esc)"
                onClick={onStop}
                className="inline-flex size-9 items-center justify-center rounded-full border border-line-strong bg-surface text-fg hover:bg-sunken pointer-coarse:size-11"
              >
                <Square size={11} fill="currentColor" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                title="Send"
                disabled={!canSend}
                className="inline-flex size-9 items-center justify-center rounded-full bg-accent text-accent-ink pointer-coarse:size-11 hover:opacity-90 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-fg-subtle disabled:hover:opacity-100"
              >
                <ArrowUp size={17} strokeWidth={2.25} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

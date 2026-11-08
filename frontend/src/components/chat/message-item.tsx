'use client';

import { Check, Copy, Pencil, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import type { Source, ThreadMessage } from '@/lib/turns';
import { Markdown } from './markdown';

/**
 * Turns the answer's [n] markers (or 【n】) into links to the matching source. Numbers with no
 * source are left as written; code spans and blocks are left alone.
 */
export function linkCitations(text: string, sources: readonly Source[] | undefined): string {
  if (!sources?.length) {
    return text;
  }
  const byNumber = new Map(sources.map((source) => [source.n, source.url]));
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part
            // Some models cite with full-width brackets, like 【1】 or 【1†source】.
            .replace(/【(\d{1,2})(?:†[^】]*)?】/g, '[$1]')
            .replace(/\[(\d{1,2})\](?!\()/g, (marker: string, n: string) => {
              const url = byNumber.get(Number(n));
              return url ? `[\\[${n}\\]](${url})` : marker;
            }),
    )
    .join('');
}

function Sources({ sources }: { sources: readonly Source[] }) {
  return (
    <section aria-label="Sources" className="mt-3">
      <h3 className="mb-1.5 text-xs font-medium text-fg-subtle">Sources</h3>
      <ol className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <li key={source.n}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              title={source.title}
              className="inline-flex max-w-64 items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 text-xs text-fg-muted hover:bg-surface hover:text-fg"
            >
              <span className="font-medium text-fg">{source.n}</span>
              <span className="truncate">{hostOf(source.url)}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export interface MessageItemProps {
  message: ThreadMessage;
  /** Shown only on the latest answer, when nothing is being written. */
  onRegenerate?: (() => void) | undefined;
  /** Shown only on the latest message of the user, when nothing is being written. */
  onEdit?: (() => void) | undefined;
}

/** One message: the user's on the right, answers on the left, with copy and the latest actions. */
export function MessageItem({ message, onRegenerate, onEdit }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const writing = message.status === 'streaming';

  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <li className={cn('group flex flex-col gap-1', isUser ? 'items-end' : 'items-stretch')}>
      <span className="sr-only">{isUser ? 'You said:' : 'GilderAi said:'}</span>
      {isUser ? (
        <div className="max-w-[85%] rounded-lg bg-sunken px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-fg">
          {message.content}
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-fg" aria-busy={writing}>
          {message.content ? (
            <Markdown>{linkCitations(message.content, message.sources)}</Markdown>
          ) : null}
          {writing && !message.content ? (
            <span className="inline-flex gap-1 py-2" aria-label="Writing the answer">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 animate-pulse rounded-full bg-fg-subtle"
                  style={{ animationDelay: `${dot * 150}ms` }}
                />
              ))}
            </span>
          ) : null}
          {message.sources?.length ? <Sources sources={message.sources} /> : null}
          {message.status === 'stopped' ? (
            <p className="mt-1 text-xs text-fg-subtle">Stopped</p>
          ) : null}
          {message.status === 'failed' ? (
            <p className="mt-1 text-xs text-danger">
              {message.error?.message ?? 'This answer failed. Your credits were not charged.'}
              {message.error?.requestId ? (
                <span className="text-fg-subtle"> Reference: {message.error.requestId}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      )}
      {!writing ? (
        <div
          className={cn(
            'flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100',
            isUser ? 'justify-end' : 'justify-start',
          )}
        >
          {message.content ? (
            <IconButton
              label={copied ? 'Copied' : 'Copy'}
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              size="sm"
              onClick={() => void copy()}
            />
          ) : null}
          {onEdit ? (
            <IconButton label="Edit" icon={<Pencil size={14} />} size="sm" onClick={onEdit} />
          ) : null}
          {onRegenerate ? (
            <IconButton
              label="Regenerate"
              icon={<RotateCcw size={14} />}
              size="sm"
              onClick={onRegenerate}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

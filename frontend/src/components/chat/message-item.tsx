'use client';

import { Check, Copy, FileText, ImageIcon, Pencil, RefreshCw } from 'lucide-react';
import { memo, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import type { Citation, Source, ThreadMessage } from '@/lib/turns';
import { openFile } from '@/lib/uploads';
import { useGetFileQuery } from '@/store/api';
import { FilesCard } from './files-card';
import { agentInfo, costOf, creditsLabel, fileSize } from './composer';
import { GeneratedFiles } from './generated-files';
import { Markdown } from './markdown';

/** Runs `change` on the text outside code spans and blocks, which are left as written. */
function outsideCode(text: string, change: (part: string) => string): string {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) => (index % 2 === 1 ? part : change(part)))
    .join('');
}

/**
 * Turns the answer's [n] markers (or 【n】) into links to the matching source. Numbers with no
 * source are left as written; code spans and blocks are left alone.
 */
export function linkCitations(text: string, sources: readonly Source[] | undefined): string {
  if (!sources?.length) {
    return text;
  }
  const byNumber = new Map(sources.map((source) => [source.n, source]));
  return outsideCode(text, (part) =>
    part
      // Some models cite with full-width brackets, like 【1】 or 【1†source】.
      .replace(/【(\d{1,2})(?:†[^】]*)?】/g, '[$1]')
      .replace(/\[(\d{1,2})\](?!\()/g, (marker: string, n: string) => {
        const source = byNumber.get(Number(n));
        // The title marks the link as a citation, which the Markdown renderer draws as a pill.
        return source
          ? `[${n}](${source.url} "${linkTitle(`Source ${n}: ${source.title || hostOf(source.url)}`)}")`
          : marker;
      }),
  );
}

/** Text for a Markdown link title: one line, with its quotes and backslashes escaped. */
function linkTitle(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/["\\]/g, '\\$&');
}

/**
 * Turns the answer's [p. N] page marks (or 【p. N】, in answers saved before the server cleaned
 * them) into page tags: a link to #page-N, which the Markdown renderer shows as a small tag,
 * with the passages cited from that page as its hover text. Code is left alone.
 */
export function tagPages(text: string, citations: readonly Citation[] | undefined): string {
  if (!citations?.length) {
    return text;
  }
  const passages = new Map<number, string[]>();
  for (const citation of citations) {
    const quote = `${citation.name}: ${citation.quote}`;
    passages.set(citation.page, [...(passages.get(citation.page) ?? []), quote]);
  }
  return outsideCode(text, (part) =>
    part
      .replace(/【\s*p\.\s*(\d{1,4})\s*(?:†[^】]*)?】/g, '[p. $1]')
      .replace(/\[p\.\s*(\d{1,4})\](?!\()/g, (_marker: string, n: string) => {
        const hover = passages.get(Number(n));
        return `[p. ${n}](#page-${n}${hover ? ` "${linkTitle(hover.join(' · '))}"` : ''})`;
      }),
  );
}

function Sources({ sources }: { sources: readonly Source[] }) {
  return (
    <section aria-label="Sources" className="flex flex-col gap-2">
      <h3 className="text-[12.5px] font-medium text-fg-subtle">Sources</h3>
      {/* On phones the cards scroll sideways in one row; wider screens wrap them. */}
      <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {sources.map((source) => (
          <li key={source.n} className="w-[236px] shrink-0">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              title={source.title}
              className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 text-fg hover:border-line-strong hover:bg-sunken"
            >
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-line bg-sunken text-[11.5px] font-semibold text-accent-text">
                {source.n}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] leading-[1.35] font-medium">
                  {source.title || hostOf(source.url)}
                </span>
                <span className="truncate text-xs text-fg-muted">{hostOf(source.url)}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A file sent with a message: its name, pages and size; a click opens it in the browser. */
function AttachmentChip({ fileId }: { fileId: string }) {
  const { data } = useGetFileQuery(fileId);
  const file = data?.file;
  const meta = [
    file?.pageCount ? `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}` : null,
    file?.sizeBytes ? fileSize(file.sizeBytes) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const Icon = file?.purpose === 'image' ? ImageIcon : FileText;
  return (
    <button
      type="button"
      onClick={() => void openFile(fileId, true)}
      className="inline-flex max-w-72 items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2 text-left hover:bg-sunken"
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-accent-text" />
      <span className="truncate text-[13px] font-medium text-fg">{file?.name ?? 'File'}</span>
      {meta ? <span className="shrink-0 text-xs text-fg-muted">{meta}</span> : null}
    </button>
  );
}

/** The passages of the user's documents an answer is based on, as quote cards. */
function Citations({ citations }: { citations: readonly Citation[] }) {
  const documents = new Set(citations.map((citation) => citation.documentId));
  return (
    <section aria-label="Pages cited" className="mt-3 flex flex-col gap-2">
      <h3 className="text-[12.5px] font-medium text-fg-subtle">
        {documents.size > 1 ? 'From your documents' : 'From your document'}
      </h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2">
        {citations.map((citation) => (
          <figure
            key={`${citation.documentId}-${citation.page}-${citation.quote.slice(0, 20)}`}
            className="m-0 flex flex-col gap-1.5 rounded-md border border-line bg-surface px-3.5 py-3"
          >
            <figcaption className="text-xs font-semibold text-accent-text">
              Page {citation.page}
              {documents.size > 1 ? ` · ${citation.name}` : ''}
            </figcaption>
            <blockquote className="m-0 text-[13.5px] leading-normal text-fg-muted">
              {citation.quote}
            </blockquote>
          </figure>
        ))}
      </div>
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

function MessageItemView({ message, onRegenerate, onEdit }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const writing = message.status === 'streaming';

  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  if (isUser) {
    return (
      <li className="flex flex-col items-end gap-1.5">
        <span className="sr-only">You said:</span>
        {message.attachments?.length ? (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-1.5">
            {message.attachments.map((fileId) => (
              <AttachmentChip key={fileId} fileId={fileId} />
            ))}
          </div>
        ) : null}
        <div className="max-w-[80%] rounded-lg bg-user px-4 py-3 text-[15px] leading-[1.55] whitespace-pre-wrap text-fg">
          {message.content}
        </div>
        {!writing ? (
          <div className="flex gap-0.5">
            {onEdit ? (
              <IconButton
                label="Edit"
                icon={<Pencil size={16} strokeWidth={1.75} />}
                size="sm"
                onClick={onEdit}
                className="size-9 text-fg-subtle pointer-coarse:size-11"
              />
            ) : null}
            {message.content ? (
              <IconButton
                label={copied ? 'Copied' : 'Copy message'}
                icon={copied ? <Check size={16} /> : <Copy size={16} strokeWidth={1.75} />}
                size="sm"
                onClick={() => void copy()}
                className="size-9 text-fg-subtle pointer-coarse:size-11"
              />
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3.5" aria-busy={writing}>
      <span className="sr-only">GilderAi said:</span>
      <AnswerMeta message={message} />
      {message.sources?.length ? <Sources sources={message.sources} /> : null}
      <div
        className={cn(
          'text-[15.5px] leading-[1.65] text-fg',
          writing && message.content && 'answer-writing',
        )}
      >
        {message.content ? (
          <Markdown>
            {tagPages(linkCitations(message.content, message.sources), message.citations)}
          </Markdown>
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
        {message.files?.length && !writing ? <FilesCard files={message.files} /> : null}
        {writing && message.progress ? (
          <JobCard
            agent={message.agent}
            progress={message.progress}
            steps={message.progressSteps ?? [message.progress.step]}
          />
        ) : null}
        {message.generated?.length ? <GeneratedFiles fileIds={message.generated} /> : null}
        {message.citations?.length ? <Citations citations={message.citations} /> : null}
        {message.status === 'failed' ? (
          <p className="mt-1 text-xs text-danger">
            {message.error?.message ?? 'This answer failed. Your credits were not charged.'}
            {message.error?.requestId ? (
              <span className="text-fg-subtle"> Reference: {message.error.requestId}</span>
            ) : null}
          </p>
        ) : null}
      </div>
      {!writing && (message.content || onRegenerate) ? (
        <div className="-ml-2 flex items-center gap-0.5 [&>button]:pointer-coarse:min-h-11">
          {message.content ? (
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2.5 text-[13px] text-fg-muted hover:bg-sunken hover:text-fg"
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} strokeWidth={1.75} aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          ) : null}
          {onRegenerate ? (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2.5 text-[13px] text-fg-muted hover:bg-sunken hover:text-fg"
            >
              <RefreshCw size={15} strokeWidth={1.75} aria-hidden="true" />
              Regenerate
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** "3.2 s", "12 s" or "1 min 5 s". */
export function duration(ms: number): string {
  const seconds = ms / 1_000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)} s`;
  }
  if (seconds < 60) {
    return `${Math.round(seconds)} s`;
  }
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${whole % 60} s`;
}

/** Agents that make a file, which takes a while and shows a job card. */
const FILE_AGENTS = new Set(['pdf', 'slides', 'image']);

const JOB_TITLES: Record<string, string> = {
  pdf: 'Creating your PDF',
  slides: 'Creating your slides',
  image: 'Creating your image',
};

/** While a file is being made: the step, a progress bar and the steps so far. */
function JobCard({
  agent,
  progress,
  steps,
}: {
  agent: string | null | undefined;
  progress: { step: string; current: number; total: number };
  steps: readonly string[];
}) {
  const percent = Math.round((progress.current / progress.total) * 100);
  return (
    <div
      role="status"
      className="mt-1 flex max-w-[520px] flex-col gap-3 rounded-md border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {JOB_TITLES[agent ?? ''] ?? 'Creating your file'}
        </span>
        <span className="text-[12.5px] text-fg-muted">
          Step {progress.current} of {progress.total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const done = index < steps.length - 1;
          return (
            <li
              key={step}
              className={cn(
                'flex items-center gap-2.5 text-[13.5px]',
                done ? 'text-fg-muted' : 'text-fg',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  done
                    ? 'border-success bg-success-soft text-success'
                    : 'border-accent-border bg-accent-soft text-accent-text',
                )}
              >
                {done ? (
                  <Check size={12} strokeWidth={2.5} />
                ) : (
                  <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                )}
              </span>
              <span>{step}</span>
              <span className="ml-auto text-xs text-fg-subtle">
                {done ? 'Done' : 'In progress'}
              </span>
            </li>
          );
        })}
      </ol>
      <span className="text-[12.5px] text-fg-muted">Keep this chat open until it is ready.</span>
    </div>
  );
}

/** Above an answer: which agent wrote it, and what it cost and how long it took. */
function AnswerMeta({ message }: { message: ThreadMessage }) {
  const info = agentInfo(message.agent);
  const making = FILE_AGENTS.has(message.agent ?? '');
  const details =
    message.status === 'streaming'
      ? making && info
        ? `${creditsLabel(costOf(message.agent))} reserved`
        : 'Writing…'
      : message.status === 'stopped'
        ? 'Stopped'
        : message.status === 'failed'
          ? null
          : [
              typeof message.credits === 'number' ? creditsLabel(message.credits) : null,
              typeof message.latencyMs === 'number'
                ? `answered in ${duration(message.latencyMs)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || null;
  if (!info && !details) {
    return null;
  }
  const Icon = info?.icon;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-muted">
      {info && Icon ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft py-0.5 pr-2.5 pl-2 font-medium text-accent-text">
          <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
          {info.label}
        </span>
      ) : null}
      {details ? <span>{details}</span> : null}
    </div>
  );
}

/**
 * One message: the user's on the right, answers on the left, with copy and the latest actions.
 * Memoised: while an answer streams, only that answer's object changes, so the messages above it
 * are not rendered again on every word.
 */
export const MessageItem = memo(MessageItemView);

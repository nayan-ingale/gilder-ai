'use client';

import { Code2 } from 'lucide-react';
import { useContext, useState } from 'react';
import { cn } from '@/components/ui/cn';
import type { CodeFile } from '@/lib/code-files';
import { ArtifactContext } from './artifact-context';
import { ArtifactPanel } from './artifact-panel';

const LANGUAGE_NAMES: Record<string, string> = {
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TypeScript',
  py: 'Python',
  python: 'Python',
  json: 'JSON',
  md: 'Markdown',
  markdown: 'Markdown',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Shell',
};

/** "HTML, CSS, JavaScript": the languages of the files, each once, in the order they come. */
export function languagesOf(files: readonly CodeFile[]): string {
  const names = files.map((file) => {
    const language = file.language.trim().toLowerCase();
    return (
      LANGUAGE_NAMES[language] ?? (language ? language[0]!.toUpperCase() + language.slice(1) : '')
    );
  });
  return [...new Set(names.filter(Boolean))].join(', ');
}

/**
 * Under a code answer: the files it made, as a card that opens them. On the chat page they open
 * in its panel (beside the chat on large screens); shown on its own, the card opens a sheet.
 */
export function FilesCard({ files }: { files: readonly CodeFile[] }) {
  const artifact = useContext(ArtifactContext);
  const [open, setOpen] = useState(false);
  const isOpen = artifact ? artifact.shown === files : open;
  const title = artifact?.title ?? 'Code';
  const languages = languagesOf(files);
  const count = `${files.length} ${files.length === 1 ? 'file' : 'files'}`;
  return (
    <>
      <button
        type="button"
        aria-pressed={isOpen}
        onClick={() => (artifact ? artifact.toggle(files) : setOpen(true))}
        className={cn(
          'mt-3 flex w-full max-w-[420px] items-center gap-3 rounded-md border bg-surface px-3.5 py-3 text-left text-fg hover:bg-sunken',
          isOpen ? 'border-accent-border' : 'border-line',
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent-text"
        >
          <Code2 size={18} strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="truncate text-[12.5px] text-fg-muted">
            {languages ? `${count} · ${languages}` : count}
          </span>
        </span>
        <span className="text-[12.5px] font-medium text-accent-text">
          {isOpen ? 'Close' : 'Open'}
        </span>
      </button>
      {!artifact && open ? (
        <ArtifactPanel files={files} open={open} onOpenChange={setOpen} title={title} />
      ) : null}
    </>
  );
}

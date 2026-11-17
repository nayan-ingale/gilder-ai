'use client';

import { Check, Code2, Copy, Eye, FileArchive, ShieldCheck, X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ReactNode, useMemo, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { type CodeFile, download, previewDocument, zipFiles } from '@/lib/code-files';
import { highlightCode } from '@/lib/highlight';
import { CodeEditor } from './code-editor';

export interface ArtifactPanelProps {
  files: readonly CodeFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the code is called: the chat's title. */
  title?: string;
  /** Which code answer of the chat this is, counting from 1. */
  version?: number;
  /** Beside the chat (on large screens) instead of a sheet over it. */
  docked?: boolean;
}

/**
 * The files of a code answer: a Code view with one tab per file in the read-only editor, a live
 * Preview for a web page, and downloads. Docked beside the chat on large screens, a sheet over it
 * on small ones. The preview runs in a sandboxed frame with no access to this page.
 */
export function ArtifactPanel({
  files,
  open,
  onOpenChange,
  title = 'Code',
  version,
  docked = false,
}: ArtifactPanelProps) {
  if (!open) {
    return null;
  }
  if (docked) {
    return (
      <aside
        aria-label="Code files"
        className="sticky top-0 flex h-dvh w-[min(600px,50%)] shrink-0 flex-col self-start border-l border-line bg-surface"
      >
        <ArtifactBody
          files={files}
          title={title}
          version={version}
          onClose={() => onOpenChange(false)}
          heading={(text) => <h2 className="truncate text-sm font-semibold text-fg">{text}</h2>}
        />
      </aside>
    );
  }
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-raised md:w-[min(56rem,80vw)]">
          <DialogPrimitive.Description className="sr-only">
            The files from this answer, with a preview and downloads.
          </DialogPrimitive.Description>
          <ArtifactBody
            files={files}
            title={title}
            version={version}
            onClose={() => onOpenChange(false)}
            heading={(text) => (
              <DialogPrimitive.Title className="truncate text-sm font-semibold text-fg">
                {text}
              </DialogPrimitive.Title>
            )}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ArtifactBody({
  files,
  title,
  version,
  onClose,
  heading,
}: {
  files: readonly CodeFile[];
  title: string;
  version: number | undefined;
  onClose: () => void;
  heading: (text: string) => ReactNode;
}) {
  const preview = useMemo(() => previewDocument(files), [files]);
  const [view, setView] = useState<'code' | 'preview'>('code');
  const [fileName, setFileName] = useState(files[0]?.name ?? '');
  const [copied, setCopied] = useState(false);
  const current = files.find((file) => file.name === fileName) ?? files[0];
  const showingPreview = view === 'preview' && preview !== null;
  const count = `${files.length} ${files.length === 1 ? 'file' : 'files'}`;

  async function copy() {
    if (current) {
      await navigator.clipboard.writeText(current.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    }
  }

  return (
    <>
      <div className="flex min-h-[60px] flex-wrap items-center gap-2.5 border-b border-line py-2 pr-3 pl-5">
        <div className="flex min-w-[160px] flex-1 flex-col">
          {heading(title)}
          <span className="truncate text-xs text-fg-muted">
            {version ? `Version ${version} · ${count}` : count}
          </span>
        </div>
        {preview ? (
          <div
            role="tablist"
            aria-label="View"
            className="flex gap-0.5 rounded-md border border-line bg-sunken p-[3px]"
          >
            {(
              [
                ['code', 'Code', Code2],
                ['preview', 'Preview', Eye],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  'inline-flex min-h-[34px] items-center gap-1.5 rounded-sm border px-3 text-[13px]',
                  view === id
                    ? 'border-line bg-raised font-medium text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {!showingPreview ? (
          <PanelButton
            label={copied ? 'Copied' : 'Copy file'}
            onClick={() => void copy()}
            icon={copied ? <Check size={17} /> : <Copy size={17} strokeWidth={1.75} />}
          />
        ) : null}
        <PanelButton
          label="Download as zip"
          onClick={() => download(zipFiles(files), 'gilderai-files.zip')}
          icon={<FileArchive size={17} strokeWidth={1.75} />}
        />
        <PanelButton
          label="Close the files"
          onClick={onClose}
          icon={<X size={17} strokeWidth={1.75} />}
        />
      </div>

      {!showingPreview ? (
        <div
          role="tablist"
          aria-label="Files"
          className="flex overflow-x-auto border-b border-line px-3"
        >
          {files.map((file) => (
            <button
              key={file.name}
              type="button"
              role="tab"
              aria-selected={current?.name === file.name}
              onClick={() => setFileName(file.name)}
              className={cn(
                'min-h-[42px] shrink-0 border-b-2 px-3.5 font-mono text-[12.5px] whitespace-nowrap',
                current?.name === file.name
                  ? 'border-accent text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {file.name}
            </button>
          ))}
        </div>
      ) : null}

      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {showingPreview ? (
          <iframe
            title="Preview"
            srcDoc={preview}
            // Scripts may run, but with no same-origin access: no cookies, no storage, no page.
            sandbox="allow-scripts"
            className="h-full w-full flex-1 bg-white"
          />
        ) : current ? (
          <CodeEditor
            key={current.name}
            code={current.content}
            language={current.language}
            fileName={current.name}
            fallback={<CodeView code={current.content} language={current.language} />}
          />
        ) : null}
      </div>

      {preview ? (
        <p className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[12.5px] text-fg-muted">
          <ShieldCheck size={15} strokeWidth={1.75} aria-hidden="true" />
          Preview runs in a sandbox with no access to your account or cookies.
        </p>
      ) : null}
    </>
  );
}

function PanelButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-sunken hover:text-fg"
    >
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </button>
  );
}

/** The file as highlighted text: shown while Monaco loads, or if it can't. */
function CodeView({ code, language }: { code: string; language: string }) {
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);
  return (
    <pre className="code-dark hljs h-full w-full overflow-auto bg-code px-4 py-3 font-mono text-[13px] leading-[1.7]">
      {highlighted === null ? (
        <code>{code}</code>
      ) : (
        // highlight.js escapes the code; its output only adds colour spans.
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      )}
    </pre>
  );
}

'use client';

import { Check, Copy, Download, FileArchive, X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useMemo, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { type CodeFile, download, previewDocument, zipFiles } from '@/lib/code-files';
import { highlightCode } from '@/lib/highlight';

const PREVIEW = '__preview__';

export interface ArtifactPanelProps {
  files: readonly CodeFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The files of a code answer, side by side with the chat: one tab per file, a live preview for a
 * web page, and downloads. The preview runs in a sandboxed frame with no access to this page and
 * no network.
 */
export function ArtifactPanel({ files, open, onOpenChange }: ArtifactPanelProps) {
  const preview = useMemo(() => previewDocument(files), [files]);
  const [tab, setTab] = useState<string>(files[0]?.name ?? PREVIEW);
  const [copied, setCopied] = useState(false);
  const current = files.find((file) => file.name === tab);

  async function copy() {
    if (current) {
      await navigator.clipboard.writeText(current.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-canvas/60" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-xl md:w-[min(56rem,70vw)]">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
            <DialogPrimitive.Title className="text-sm font-medium text-fg">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              The files from this answer, with a preview and downloads.
            </DialogPrimitive.Description>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => download(zipFiles(files), 'gilderai-files.zip')}
              >
                <FileArchive size={14} aria-hidden="true" />
                Download all
              </Button>
              <DialogPrimitive.Close asChild>
                <IconButton label="Close" icon={<X size={16} />} size="sm" />
              </DialogPrimitive.Close>
            </div>
          </header>
          <div
            role="tablist"
            aria-label="Files"
            className="flex gap-1 overflow-x-auto border-b border-line px-2"
          >
            {preview ? (
              <TabButton active={tab === PREVIEW} onClick={() => setTab(PREVIEW)}>
                Preview
              </TabButton>
            ) : null}
            {files.map((file) => (
              <TabButton
                key={file.name}
                active={tab === file.name}
                onClick={() => setTab(file.name)}
              >
                {file.name}
              </TabButton>
            ))}
          </div>
          <div role="tabpanel" className="min-h-0 flex-1 overflow-auto">
            {tab === PREVIEW && preview ? (
              <iframe
                title="Preview"
                srcDoc={preview}
                // Scripts may run, but with no same-origin access: no cookies, no storage, no page.
                sandbox="allow-scripts"
                className="h-full w-full bg-white"
              />
            ) : current ? (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between px-4 py-1.5 text-xs text-fg-subtle">
                  <span>{current.language}</span>
                  <div className="flex gap-1">
                    <IconButton
                      label={copied ? 'Copied' : 'Copy file'}
                      icon={copied ? <Check size={14} /> : <Copy size={14} />}
                      size="sm"
                      onClick={() => void copy()}
                    />
                    <IconButton
                      label="Download file"
                      icon={<Download size={14} />}
                      size="sm"
                      onClick={() =>
                        download(
                          new Blob([current.content], { type: 'text/plain' }),
                          current.name.split('/').pop() ?? 'file.txt',
                        )
                      }
                    />
                  </div>
                </div>
                <CodeView code={current.content} language={current.language} />
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'shrink-0 border-b-2 px-3 py-2 text-xs whitespace-nowrap',
        active ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function CodeView({ code, language }: { code: string; language: string }) {
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);
  return (
    <pre className="hljs min-h-0 flex-1 overflow-auto px-4 pb-4 text-[13px] leading-relaxed">
      {highlighted === null ? (
        <code>{code}</code>
      ) : (
        // highlight.js escapes the code; its output only adds colour spans.
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      )}
    </pre>
  );
}

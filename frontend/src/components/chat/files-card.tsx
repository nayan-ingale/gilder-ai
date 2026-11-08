'use client';

import { FileCode2 } from 'lucide-react';
import { useState } from 'react';
import type { CodeFile } from '@/lib/code-files';
import { ArtifactPanel } from './artifact-panel';

/** Under a code answer: what files it made, and a button that opens them. */
export function FilesCard({ files }: { files: readonly CodeFile[] }) {
  const [open, setOpen] = useState(false);
  const names = files.map((file) => file.name);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full max-w-md items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2.5 text-left hover:bg-surface"
      >
        <FileCode2 size={18} aria-hidden="true" className="shrink-0 text-accent-text" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">
            Open {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
          <span className="block truncate text-xs text-fg-subtle">{names.join(', ')}</span>
        </span>
      </button>
      {open ? <ArtifactPanel files={files} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { openFile } from '@/lib/uploads';
import { useGetFileQuery } from '@/store/api';
import { fileSize } from './composer';

/**
 * Files an answer made. Links are never stored: an image asks for a fresh signed link to show
 * itself, and a document asks for one when downloaded.
 */
export function GeneratedFiles({ fileIds }: { fileIds: readonly string[] }) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {fileIds.map((fileId) => (
        <GeneratedFile key={fileId} fileId={fileId} />
      ))}
    </div>
  );
}

function GeneratedFile({ fileId }: { fileId: string }) {
  const { data } = useGetFileQuery(fileId);
  const file = data?.file;
  if (!file) {
    return <Skeleton className="h-20 w-full max-w-[520px]" />;
  }
  if (file.purpose === 'image') {
    return <GeneratedImage fileId={fileId} name={file.name} />;
  }
  const meta = [
    file.pageCount ? `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}` : null,
    file.sizeBytes ? fileSize(file.sizeBytes) : null,
    'link refreshes automatically',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex w-full max-w-[520px] flex-wrap items-center gap-3.5 rounded-md border border-line bg-surface p-3.5">
      <span
        aria-hidden="true"
        className="flex h-[52px] w-11 shrink-0 items-end justify-center rounded-sm border border-line bg-raised pb-1.5 text-[10px] font-semibold text-accent-text"
      >
        {file.purpose === 'slides' ? 'PPTX' : 'PDF'}
      </span>
      <span className="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-fg">{file.name}</span>
        <span className="text-[12.5px] text-fg-muted">{meta}</span>
      </span>
      <FileButtons fileId={fileId} name={file.name} canOpen={file.purpose !== 'slides'} />
    </div>
  );
}

/** Download (the main action) and, for files a browser can show, Open. */
function FileButtons({
  fileId,
  name,
  canOpen,
}: {
  fileId: string;
  name: string;
  canOpen: boolean;
}) {
  return (
    <span className="flex gap-1.5">
      <button
        type="button"
        onClick={() => void openFile(fileId)}
        aria-label={`Download ${name}`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-accent px-3.5 text-[13px] font-semibold text-accent-ink hover:opacity-90"
      >
        <Download size={15} strokeWidth={2} aria-hidden="true" />
        Download
      </button>
      {canOpen ? (
        <button
          type="button"
          onClick={() => void openFile(fileId, true)}
          aria-label={`Open ${name}`}
          className="inline-flex min-h-10 items-center rounded-sm border border-line px-3.5 text-[13px] text-fg hover:bg-sunken"
        >
          Open
        </button>
      ) : null}
    </span>
  );
}

function GeneratedImage({ fileId, name }: { fileId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ url: string }>(`/files/${encodeURIComponent(fileId)}/url`)
      .then(({ url: fresh }) => {
        if (!cancelled) {
          setUrl(fresh);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (failed) {
    return <p className="text-xs text-fg-subtle">The image could not be loaded.</p>;
  }
  if (!url) {
    return <Skeleton className="aspect-square w-full max-w-sm" />;
  }
  return (
    <figure className="m-0 flex max-w-sm flex-col gap-2">
      {/* A short-lived signed link from our own storage; next/image would need every bucket host listed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name.replace(/\.[^.]+$/, '').replaceAll('-', ' ')}
        className="w-full rounded-md border border-line"
      />
      <FileButtons fileId={fileId} name={name} canOpen />
    </figure>
  );
}

'use client';

import { Download, FileText, Presentation } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { openFile } from '@/lib/uploads';
import { useGetFileQuery } from '@/store/api';

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
    return <Skeleton className="h-14 w-full max-w-md" />;
  }
  if (file.purpose === 'image') {
    return <GeneratedImage fileId={fileId} name={file.name} />;
  }
  const Icon = file.purpose === 'slides' ? Presentation : FileText;
  return (
    <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2.5">
      <Icon size={18} aria-hidden="true" className="shrink-0 text-accent-text" />
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{file.name}</span>
      <Button size="sm" variant="secondary" onClick={() => void openFile(fileId)}>
        <Download size={14} aria-hidden="true" />
        Download
      </Button>
    </div>
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
        className="w-full rounded-lg border border-line"
      />
      <Button
        size="sm"
        variant="ghost"
        className="self-start"
        onClick={() => void openFile(fileId)}
      >
        <Download size={14} aria-hidden="true" />
        Download
      </Button>
    </figure>
  );
}

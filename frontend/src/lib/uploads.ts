import { ApiError, apiFetch } from './api';

/**
 * Uploading a file to a chat: the app asks for a signed form (the server checks the type, size
 * and chat), the browser sends the file straight to storage, then the app asks the server to
 * check what arrived. PDFs are then read for questions; images are ready at once.
 */

export interface UploadedFile {
  id: string;
  name: string;
  mime: string;
  purpose: 'pdf' | 'image' | 'slides';
  status: 'pending' | 'ready' | 'failed';
  pageCount: number | null;
}

export const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;
const LIMITS: Record<string, number> = {
  'application/pdf': 20 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/jpeg': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
};

/** A reason the file can't be sent, checked before uploading; null when it is fine. */
export function uploadProblem(file: File): string | null {
  const limit = LIMITS[file.type];
  if (!limit) {
    return 'Attach a PDF, or a PNG, JPEG or WebP image';
  }
  if (file.size > limit) {
    return `${file.name} is too big: the limit is ${limit / 1024 / 1024} MB`;
  }
  return null;
}

export async function uploadFile(file: File, chatId: string): Promise<UploadedFile> {
  const { file: started, upload } = await apiFetch<{
    file: UploadedFile;
    upload: { url: string; fields: Record<string, string> };
  }>('/files/uploads', {
    method: 'POST',
    json: { chatId, name: file.name, mime: file.type, sizeBytes: file.size },
  });

  // The form's fields must come before the file itself.
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) {
    form.append(name, value);
  }
  form.append('file', file);
  let stored: Response;
  try {
    stored = await fetch(upload.url, { method: 'POST', body: form });
  } catch {
    throw new ApiError(
      0,
      'network_error',
      'The upload could not reach storage. Check your connection.',
    );
  }
  if (!stored.ok) {
    throw new ApiError(stored.status, 'upload_failed', 'Storage refused the upload. Try again.');
  }

  const { file: completed } = await apiFetch<{ file: UploadedFile }>(
    `/files/${encodeURIComponent(started.id)}/complete`,
    { method: 'POST' },
  );
  return completed;
}

/** Whether an uploaded PDF has finished being read for questions. */
export async function pdfReadingState(
  fileId: string,
): Promise<'indexing' | 'ready' | 'failed' | null> {
  const { indexing } = await apiFetch<{ indexing: 'indexing' | 'ready' | 'failed' | null }>(
    `/files/${encodeURIComponent(fileId)}`,
  );
  return indexing;
}

/** Opens a fresh, short-lived download link for a file. */
export async function openFile(fileId: string): Promise<void> {
  const { url } = await apiFetch<{ url: string }>(`/files/${encodeURIComponent(fileId)}/url`);
  window.open(url, '_blank', 'noopener,noreferrer');
}

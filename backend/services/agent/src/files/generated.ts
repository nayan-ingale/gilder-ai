import { mongoose } from '@gilder/shared';
import { storageKey } from './file-checks.ts';
import type { FileStore } from './file-store.ts';
import { FileModel, type FileDocument } from './models.ts';

/** A generated file as the stream announces it: a fresh link, never stored. */
export interface GeneratedFile {
  fileId: string;
  kind: 'pdf' | 'slides' | 'image';
  name: string;
  url: string;
  expiresAt: string;
}

const LINK_SECONDS = 5 * 60;

/** Saves a file an agent made under the user's generated files, and returns it with a link. */
export async function saveGenerated(input: {
  store: FileStore;
  userId: string;
  chatId: string;
  kind: GeneratedFile['kind'];
  name: string;
  mime: string;
  bytes: Buffer;
}): Promise<{ file: FileDocument; announced: GeneratedFile }> {
  const id = new mongoose.Types.ObjectId();
  const key = storageKey(input.userId, 'generated', id.toString());
  await input.store.put(key, input.bytes, input.mime);
  const file = await FileModel.create({
    _id: id,
    userId: input.userId,
    chatId: input.chatId,
    kind: 'generated',
    purpose: input.kind,
    name: input.name,
    s3Key: key,
    mime: input.mime,
    sizeBytes: input.bytes.length,
    status: 'ready',
  });
  return {
    file,
    announced: {
      fileId: file.id,
      kind: input.kind,
      name: input.name,
      url: await input.store.downloadUrl(key, input.name),
      expiresAt: new Date(Date.now() + LINK_SECONDS * 1000).toISOString(),
    },
  };
}

/** A file name from a title: plain words, hyphens, the given extension. */
export function fileNameFrom(title: string, extension: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'gilderai'}.${extension}`;
}

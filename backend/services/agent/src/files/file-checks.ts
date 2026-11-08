/**
 * What may be uploaded. The type a browser claims is only a first filter: after the upload the
 * file's first bytes must match too, so a renamed file can't pass as a PDF or an image.
 */

export const UPLOAD_TYPES = {
  'application/pdf': { purpose: 'pdf', maxBytes: 20 * 1024 * 1024, extension: 'pdf' },
  'image/png': { purpose: 'image', maxBytes: 10 * 1024 * 1024, extension: 'png' },
  'image/jpeg': { purpose: 'image', maxBytes: 10 * 1024 * 1024, extension: 'jpg' },
  'image/webp': { purpose: 'image', maxBytes: 10 * 1024 * 1024, extension: 'webp' },
} as const;

export type UploadType = keyof typeof UPLOAD_TYPES;
export const MAX_PDF_PAGES = 200;

export function isUploadType(mime: string): mime is UploadType {
  return mime in UPLOAD_TYPES;
}

/** True when the first bytes are what files of this type always start with. */
export function matchesSignature(mime: UploadType, head: Buffer): boolean {
  switch (mime) {
    case 'application/pdf':
      return head.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'image/png':
      return head
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'image/webp':
      return (
        head.subarray(0, 4).toString('latin1') === 'RIFF' &&
        head.subarray(8, 12).toString('latin1') === 'WEBP'
      );
  }
}

/**
 * A display name that is safe anywhere it is shown or downloaded: no folders, no control
 * characters, at most 120 characters, and the type's own extension. It never reaches a key.
 */
export function displayName(raw: string, mime: UploadType): string {
  // Control characters (codes below 32, and 127) are dropped first.
  const printable = [...raw]
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join('');
  const base = printable
    .split(/[\\/]/)
    .pop()!
    .replace(/["<>|*?:]/g, '')
    .replace(/\.[^.]*$/, '')
    // No hidden or dot-only names.
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return `${base || 'file'}.${UPLOAD_TYPES[mime].extension}`;
}

/** The storage key: built from IDs only, so a file name can never choose or change it. */
export function storageKey(userId: string, kind: 'upload' | 'generated', fileId: string): string {
  return `users/${userId}/${kind}s/${fileId}`;
}

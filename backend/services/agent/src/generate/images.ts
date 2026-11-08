import { deflateSync } from 'node:zlib';
import { AppError } from '@gilder/shared';

/**
 * Draws an image from a prompt: Pollinations in live mode (no key needed), a plain generated PNG
 * in mock mode, so the rest of the flow (storage, links) is the same either way.
 */

export interface DrawnImage {
  bytes: Buffer;
  mime: 'image/jpeg' | 'image/png';
}

export type DrawImage = (prompt: string, signal?: AbortSignal) => Promise<DrawnImage>;

const MAX_BYTES = 8 * 1024 * 1024;

export const pollinationsImage: DrawImage = async (prompt, signal) => {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 500))}?width=1024&height=1024&nologo=true&private=true`;
  const timeout = AbortSignal.timeout(90_000);
  let response: Response;
  try {
    response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new AppError('service_unavailable', 'The image service did not answer in time', {
      cause: error,
    });
  }
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !/^image\/(jpeg|png)/.test(type)) {
    throw new AppError('service_unavailable', `The image service answered ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    throw new AppError('service_unavailable', 'The image service sent a file that is too big');
  }
  return { bytes, mime: type.startsWith('image/png') ? 'image/png' : 'image/jpeg' };
};

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A small one-colour PNG, coloured by the prompt: the mock-mode image. */
export function solidPng(prompt: string, size = 64): Buffer {
  const seed = [...prompt].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 16_777_216, 7);
  const colour = Buffer.from([(seed >> 16) & 0xff, (seed >> 8) & 0xff, seed & 0xff]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.concat(Array.from({ length: size }, () => colour)),
  ]);
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export const mockImage: DrawImage = async (prompt) => ({
  bytes: solidPng(prompt),
  mime: 'image/png',
});

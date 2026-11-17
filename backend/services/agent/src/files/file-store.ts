import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Where files live: an S3 bucket (in development too). Browsers upload straight to S3 with a
 * short-lived signed form that fixes the key, the type and the size range, and download through
 * short-lived signed links. Nothing is public.
 */

export interface UploadForm {
  url: string;
  fields: Record<string, string>;
}

export interface StoredObject {
  sizeBytes: number;
  contentType: string | undefined;
}

export interface FileStore {
  /** A signed form for one upload to exactly this key, this type and at most `maxBytes`. */
  uploadForm(key: string, contentType: string, maxBytes: number): Promise<UploadForm>;
  head(key: string): Promise<StoredObject | null>;
  /** The object's bytes, or only the first `firstBytes` of them. */
  read(key: string, firstBytes?: number): Promise<Buffer>;
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  /**
   * A signed link, valid for a few minutes: a download saved under `fileName`, or with `inline`,
   * shown in the browser.
   */
  downloadUrl(key: string, fileName: string, inline?: boolean): Promise<string>;
  remove(keys: string[]): Promise<void>;
}

const LINK_SECONDS = 5 * 60;

export interface S3Settings {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createS3FileStore(settings: S3Settings): FileStore {
  const client = new S3Client({
    region: settings.region,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  });
  const Bucket = settings.bucket;

  return {
    async uploadForm(key, contentType, maxBytes) {
      const { url, fields } = await createPresignedPost(client, {
        Bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 1, maxBytes],
          ['eq', '$Content-Type', contentType],
        ],
        Fields: { 'Content-Type': contentType },
        Expires: LINK_SECONDS,
      });
      return { url, fields };
    },
    async head(key) {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType };
      } catch (error) {
        if ((error as { name?: string }).name === 'NotFound') {
          return null;
        }
        throw error;
      }
    },
    async read(key, firstBytes) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket,
          Key: key,
          ...(firstBytes ? { Range: `bytes=0-${firstBytes - 1}` } : {}),
        }),
      );
      return Buffer.from(await result.Body!.transformToByteArray());
    },
    async put(key, bytes, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: bytes, ContentType: contentType }),
      );
    },
    async downloadUrl(key, fileName, inline = false) {
      const safeName = fileName.replace(/["\\\r\n]/g, '_');
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
        }),
        { expiresIn: LINK_SECONDS },
      );
    },
    async remove(keys) {
      if (keys.length === 0) {
        return;
      }
      await client.send(
        new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    },
  };
}

/** A bucket in memory, for tests. Uploads are simulated with `simulateUpload`. */
export function createMemoryFileStore(): FileStore & {
  objects: Map<string, { bytes: Buffer; contentType: string }>;
  simulateUpload(key: string, bytes: Buffer, contentType: string): void;
} {
  const objects = new Map<string, { bytes: Buffer; contentType: string }>();
  return {
    objects,
    simulateUpload(key, bytes, contentType) {
      objects.set(key, { bytes, contentType });
    },
    async uploadForm(key, contentType, maxBytes) {
      return {
        url: 'https://bucket.example/upload',
        fields: { key, 'Content-Type': contentType, 'x-max-bytes': String(maxBytes) },
      };
    },
    async head(key) {
      const object = objects.get(key);
      return object ? { sizeBytes: object.bytes.length, contentType: object.contentType } : null;
    },
    async read(key, firstBytes) {
      const object = objects.get(key);
      if (!object) {
        throw new Error(`no object at ${key}`);
      }
      return firstBytes ? object.bytes.subarray(0, firstBytes) : object.bytes;
    },
    async put(key, bytes, contentType) {
      objects.set(key, { bytes, contentType });
    },
    async downloadUrl(key, fileName, inline = false) {
      const mode = inline ? 'inline' : 'download';
      return `https://bucket.example/${key}?${mode}=${encodeURIComponent(fileName)}&signed=1`;
    },
    async remove(keys) {
      for (const key of keys) {
        objects.delete(key);
      }
    },
  };
}

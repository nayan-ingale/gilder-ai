import { AppError, type Logger, mongoose, requireUser, validate, z } from '@gilder/shared';
import { Router } from 'express';
import { getDocumentProxy } from 'unpdf';
import type { ChatService } from '../services.ts';
import {
  displayName,
  isUploadType,
  MAX_PDF_PAGES,
  matchesSignature,
  storageKey,
  UPLOAD_TYPES,
} from './file-checks.ts';
import type { FileStore } from './file-store.ts';
import { DocumentModel, type FileDocument, FileModel, findOwnedFile, toFile } from './models.ts';

/**
 * Uploads, in two calls around the browser's own upload to S3: start (checks the type, size and
 * chat, and returns a signed form for one fixed key) and complete (checks what actually arrived:
 * size, type, first bytes, and a PDF's pages). Files are only ever reached through their ID and
 * the owner's session; links are signed on request and expire in minutes.
 */

export interface FileRouteDeps {
  /** S3; left out, uploads answer 503. */
  store?: FileStore | undefined;
  chat: ChatService;
  logger: Logger;
  /** Called when a PDF is ready, to index it for questions. */
  onPdfReady?: (file: FileDocument) => void;
}

const startBody = z
  .object({
    chatId: z.string().min(1).max(64),
    name: z.string().min(1).max(300),
    mime: z.string().max(100),
    sizeBytes: z.number().int().min(1),
  })
  .strict();
const fileParams = z.object({ fileId: z.string().min(1).max(64) });

const notFound = () => new AppError('not_found', 'No such file');

export async function countPdfPages(bytes: Buffer): Promise<number> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  return pdf.numPages;
}

export function fileRouter(deps: FileRouteDeps): Router {
  const router = Router();
  const store = () => {
    if (!deps.store) {
      throw new AppError('service_unavailable', 'File uploads are not set up on this server');
    }
    return deps.store;
  };

  router.post('/files/uploads', requireUser(), validate({ body: startBody }), async (req, res) => {
    const userId = res.locals.userId as string;
    const body = req.body as z.output<typeof startBody>;
    if (!isUploadType(body.mime)) {
      throw new AppError('unsupported_media_type', 'Upload a PDF, or a PNG, JPEG or WebP image');
    }
    const rule = UPLOAD_TYPES[body.mime];
    if (body.sizeBytes > rule.maxBytes) {
      throw new AppError(
        'payload_too_large',
        `That file is too big: the limit is ${rule.maxBytes / 1024 / 1024} MB`,
      );
    }
    const files = store();
    await deps.chat.getChat(userId, body.chatId);

    const id = new mongoose.Types.ObjectId();
    const file = await FileModel.create({
      _id: id,
      userId,
      chatId: body.chatId,
      kind: 'upload',
      purpose: rule.purpose,
      name: displayName(body.name, body.mime),
      s3Key: storageKey(userId, 'upload', id.toString()),
      mime: body.mime,
      sizeBytes: body.sizeBytes,
    });
    const upload = await files.uploadForm(file.s3Key, body.mime, rule.maxBytes);
    res.status(201).json({ file: toFile(file), upload });
  });

  router.post(
    '/files/:fileId/complete',
    requireUser(),
    validate({ params: fileParams }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const file = await findOwnedFile(userId, (req.params as z.output<typeof fileParams>).fileId);
      if (!file || file.kind !== 'upload') {
        throw notFound();
      }
      if (file.status === 'ready') {
        res.json({ file: toFile(file) });
        return;
      }
      if (file.status === 'failed') {
        throw new AppError('conflict', 'This upload was refused; upload the file again');
      }
      const files = store();
      const stored = await files.head(file.s3Key);
      if (!stored) {
        throw new AppError('conflict', "The upload hasn't arrived yet");
      }

      const refuse = async (reason: string) => {
        await files.remove([file.s3Key]).catch(() => undefined);
        file.status = 'failed';
        await file.save();
        throw new AppError('unsupported_media_type', reason);
      };
      const mime = file.mime;
      if (
        !isUploadType(mime) ||
        stored.contentType !== mime ||
        stored.sizeBytes > UPLOAD_TYPES[mime].maxBytes
      ) {
        return refuse('The file that arrived is not the one that was announced');
      }
      if (!matchesSignature(mime, await files.read(file.s3Key, 16))) {
        return refuse(
          mime === 'application/pdf'
            ? 'That is not a PDF file'
            : 'That is not the image type it claims',
        );
      }
      if (mime === 'application/pdf') {
        let pages: number;
        try {
          pages = await countPdfPages(await files.read(file.s3Key));
        } catch {
          return refuse('That PDF could not be read');
        }
        if (pages > MAX_PDF_PAGES) {
          return refuse(`That PDF has ${pages} pages; the limit is ${MAX_PDF_PAGES}`);
        }
        file.pageCount = pages;
      }

      file.sizeBytes = stored.sizeBytes;
      file.status = 'ready';
      await file.save();
      if (file.purpose === 'pdf') {
        await DocumentModel.create({
          fileId: file._id,
          userId,
          chatId: file.chatId,
          pageCount: file.pageCount ?? 0,
        });
        deps.onPdfReady?.(file);
      }
      res.json({ file: toFile(file) });
    },
  );

  router.get(
    '/files/:fileId',
    requireUser(),
    validate({ params: fileParams }),
    async (req, res) => {
      const file = await findOwnedFile(
        res.locals.userId as string,
        (req.params as z.output<typeof fileParams>).fileId,
      );
      if (!file) {
        throw notFound();
      }
      const document =
        file.purpose === 'pdf' ? await DocumentModel.findOne({ fileId: file._id }) : null;
      res.json({ file: toFile(file), indexing: document ? document.status : null });
    },
  );

  // A fresh link each time: messages keep file IDs, so old chats never hold expired links.
  router.get(
    '/files/:fileId/url',
    requireUser(),
    validate({ params: fileParams }),
    async (req, res) => {
      const file = await findOwnedFile(
        res.locals.userId as string,
        (req.params as z.output<typeof fileParams>).fileId,
      );
      if (!file || file.status !== 'ready') {
        throw notFound();
      }
      res.json({ url: await store().downloadUrl(file.s3Key, file.name), expiresInSeconds: 300 });
    },
  );

  return router;
}

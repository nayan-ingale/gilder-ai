import type { Logger } from '@gilder/shared';
import { extractText, getDocumentProxy } from 'unpdf';
import type { FileStore } from '../files/file-store.ts';
import { DocumentModel, type FileDocument } from '../files/models.ts';
import { chunkPages } from './chunks.ts';
import type { Embedder } from './embeddings.ts';
import type { VectorStore } from './vector-store.ts';

/**
 * Makes an uploaded PDF searchable: its text page by page, cut into overlapping pieces, each
 * piece embedded and stored with its page. Runs after the upload completes; the document is
 * marked ready or failed, and questions wait for ready.
 */

export interface IndexerDeps {
  store: FileStore;
  embedder: Embedder;
  vectors: VectorStore;
  logger: Logger;
}

export async function extractPages(bytes: Buffer): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

export async function indexPdf(file: FileDocument, deps: IndexerDeps): Promise<void> {
  const document = await DocumentModel.findOne({ fileId: file._id });
  if (!document) {
    return;
  }
  try {
    const pages = await extractPages(await deps.store.read(file.s3Key));
    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new Error('This PDF has no text to read (it may be scanned images)');
    }
    const vectors = await deps.embedder.embed(
      chunks.map((chunk) => chunk.text),
      'document',
    );
    await deps.vectors.ensureReady();
    await deps.vectors.upsert(
      chunks.map((chunk, index) => ({
        vector: vectors[index] ?? [],
        payload: {
          userId: file.userId,
          documentId: document.id,
          chatId: file.chatId,
          page: chunk.page,
          text: chunk.text,
        },
      })),
    );
    document.status = 'ready';
    await document.save();
    deps.logger.info({ documentId: document.id, chunks: chunks.length }, 'PDF indexed');
  } catch (error) {
    document.status = 'failed';
    document.error = error instanceof Error ? error.message.slice(0, 300) : 'Indexing failed';
    await document.save();
    deps.logger.warn({ err: error, documentId: document.id }, 'PDF indexing failed');
  }
}

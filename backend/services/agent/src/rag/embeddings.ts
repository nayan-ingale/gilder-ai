import { createHash } from 'node:crypto';
import { AppError } from '@gilder/shared';

/**
 * Turns text into vectors for search: Gemini's embedding model in live mode, a deterministic
 * stand-in in mock mode and tests. Documents and questions are embedded for their roles.
 */

export const EMBEDDING_DIMENSIONS = 768;
const BATCH = 100;

export type EmbeddingTask = 'document' | 'query';

export interface Embedder {
  embed(texts: string[], task: EmbeddingTask, signal?: AbortSignal): Promise<number[][]>;
}

export function createGeminiEmbedder(apiKey: string): Embedder {
  return {
    async embed(texts, task, signal) {
      const vectors: number[][] = [];
      for (let start = 0; start < texts.length; start += BATCH) {
        const batch = texts.slice(start, start + BATCH);
        let response: Response;
        try {
          response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents',
            {
              method: 'POST',
              headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
              body: JSON.stringify({
                requests: batch.map((text) => ({
                  model: 'models/gemini-embedding-001',
                  content: { parts: [{ text }] },
                  taskType: task === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
                  outputDimensionality: EMBEDDING_DIMENSIONS,
                })),
              }),
              signal: signal
                ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
                : AbortSignal.timeout(30_000),
            },
          );
        } catch (error) {
          if (signal?.aborted) {
            throw error;
          }
          throw new AppError('service_unavailable', 'Document search is not available right now', {
            cause: error,
          });
        }
        if (!response.ok) {
          throw new AppError(
            'service_unavailable',
            `The embedding service answered ${response.status}`,
          );
        }
        const body = (await response.json()) as { embeddings?: { values: number[] }[] };
        vectors.push(...(body.embeddings ?? []).map((embedding) => embedding.values));
      }
      return vectors;
    },
  };
}

/** Same text, same vector: a hash spread over the dimensions. Enough for mock mode and tests. */
export const mockEmbedder: Embedder = {
  async embed(texts) {
    return texts.map((text) => {
      const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        const digest = createHash('sha256').update(word).digest();
        const slot = digest.readUInt16BE(0) % EMBEDDING_DIMENSIONS;
        vector[slot] = (vector[slot] ?? 0) + 1;
      }
      const length = Math.hypot(...vector) || 1;
      return vector.map((value) => value / length);
    });
  },
};

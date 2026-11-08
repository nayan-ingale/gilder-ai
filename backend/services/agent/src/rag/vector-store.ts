import { randomUUID } from 'node:crypto';
import { AppError } from '@gilder/shared';
import { EMBEDDING_DIMENSIONS } from './embeddings.ts';

/**
 * The PDF pieces and their vectors: one Qdrant collection, every point labelled with its owner,
 * document, chat and page. Every search filters by owner and document, so one user's
 * documents never answer another user's question.
 */

export interface ChunkPayload {
  userId: string;
  documentId: string;
  chatId: string;
  page: number;
  text: string;
}

export interface Hit {
  score: number;
  payload: ChunkPayload;
}

export interface VectorStore {
  ensureReady(): Promise<void>;
  upsert(points: { vector: number[]; payload: ChunkPayload }[]): Promise<void>;
  search(
    vector: number[],
    filter: { userId: string; documentIds: string[] },
    limit: number,
  ): Promise<Hit[]>;
  removeDocuments(filter: { userId: string; documentIds: string[] }): Promise<void>;
}

const COLLECTION = 'document_chunks';

export function createQdrantStore(baseUrl: string): VectorStore {
  const url = (path: string) => `${baseUrl.replace(/\/+$/, '')}/collections/${COLLECTION}${path}`;
  async function call(method: string, path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url(path), {
        method,
        headers: { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new AppError('service_unavailable', 'Document search is not reachable', {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new AppError('service_unavailable', `Document search answered ${response.status}`);
    }
    return response.json();
  }
  const ownerFilter = (filter: { userId: string; documentIds: string[] }) => ({
    must: [
      { key: 'userId', match: { value: filter.userId } },
      { key: 'documentId', match: { any: filter.documentIds } },
    ],
  });

  return {
    async ensureReady() {
      const exists = await fetch(url(''), { signal: AbortSignal.timeout(5_000) }).catch(
        () => undefined,
      );
      if (exists?.ok) {
        return;
      }
      await call('PUT', '', { vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' } });
      for (const field of ['userId', 'documentId', 'chatId']) {
        await call('PUT', '/index', { field_name: field, field_schema: 'keyword' });
      }
    },
    async upsert(points) {
      for (let start = 0; start < points.length; start += 256) {
        await call('PUT', '/points?wait=true', {
          points: points.slice(start, start + 256).map((point) => ({
            id: randomUUID(),
            vector: point.vector,
            payload: point.payload,
          })),
        });
      }
    },
    async search(vector, filter, limit) {
      const body = (await call('POST', '/points/search', {
        vector,
        filter: ownerFilter(filter),
        limit,
        with_payload: true,
      })) as { result: { score: number; payload: ChunkPayload }[] };
      return body.result.map(({ score, payload }) => ({ score, payload }));
    },
    async removeDocuments(filter) {
      await call('POST', '/points/delete?wait=true', { filter: ownerFilter(filter) });
    },
  };
}

/** Qdrant in memory, for tests and mock mode: cosine similarity over stored points. */
export function createMemoryVectorStore(): VectorStore & {
  points: { vector: number[]; payload: ChunkPayload }[];
} {
  const points: { vector: number[]; payload: ChunkPayload }[] = [];
  const cosine = (a: number[], b: number[]) => {
    const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
    return dot / ((Math.hypot(...a) || 1) * (Math.hypot(...b) || 1));
  };
  const matches = (payload: ChunkPayload, filter: { userId: string; documentIds: string[] }) =>
    payload.userId === filter.userId && filter.documentIds.includes(payload.documentId);
  return {
    points,
    async ensureReady() {},
    async upsert(newPoints) {
      points.push(...newPoints);
    },
    async search(vector, filter, limit) {
      return points
        .filter((point) => matches(point.payload, filter))
        .map((point) => ({ score: cosine(vector, point.vector), payload: point.payload }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
    async removeDocuments(filter) {
      for (let index = points.length - 1; index >= 0; index -= 1) {
        const point = points[index];
        if (point && matches(point.payload, filter)) {
          points.splice(index, 1);
        }
      }
    },
  };
}

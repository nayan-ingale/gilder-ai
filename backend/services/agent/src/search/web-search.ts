import { AppError } from '@gilder/shared';

/**
 * Web search for the search agent: Tavily in live mode, canned results in mock mode. Results are
 * normalized into numbered sources, trimmed, and only http(s) links are kept.
 */

export interface Source {
  /** The number the answer cites, as [n]. */
  n: number;
  title: string;
  url: string;
  snippet: string;
  image?: string;
}

export type WebSearch = (query: string, signal?: AbortSignal) => Promise<Source[]>;

const MAX_RESULTS = 5;
const SNIPPET_CHARS = 700;
const TIMEOUT_MS = 10_000;

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
}

const isWebUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value) && value.length <= 2_000;

/** Turns raw results into numbered sources, dropping anything without a usable link. */
export function toSources(results: TavilyResult[], images: unknown[] = []): Source[] {
  return results
    .filter((result) => isWebUrl(result.url))
    .slice(0, MAX_RESULTS)
    .map((result, index) => {
      const image = images[index];
      return {
        n: index + 1,
        title:
          typeof result.title === 'string' && result.title.trim()
            ? result.title.trim().slice(0, 200)
            : new URL(result.url as string).hostname,
        url: result.url as string,
        snippet:
          typeof result.content === 'string' ? result.content.trim().slice(0, SNIPPET_CHARS) : '',
        ...(isWebUrl(image) ? { image } : {}),
      };
    });
}

export function createTavilySearch(apiKey: string): WebSearch {
  return async (query, signal) => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          query: query.slice(0, 400),
          max_results: MAX_RESULTS,
          search_depth: 'basic',
          include_images: true,
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      throw new AppError('service_unavailable', 'Web search is not available right now', {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new AppError('service_unavailable', `Web search answered ${response.status}`);
    }
    const body = (await response.json()) as { results?: TavilyResult[]; images?: unknown[] };
    return toSources(body.results ?? [], body.images ?? []);
  };
}

/** Canned results for mock mode, so search runs without a Tavily key. */
export const mockWebSearch: WebSearch = async (query) =>
  toSources([
    {
      title: `Example result about ${query.slice(0, 60)}`,
      url: 'https://example.com/one',
      content: 'Mock mode returns canned search results, so the app runs without a search key.',
    },
    {
      title: 'A second example source',
      url: 'https://example.org/two',
      content: 'Answers cite sources by number, like [1] and [2].',
    },
  ]);

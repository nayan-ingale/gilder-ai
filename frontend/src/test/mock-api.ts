import { vi } from 'vitest';

/** One call the code under test made to /api. */
export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

export type ApiAnswer = (call: ApiCall) => Response;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Stands in for the network in component tests: every fetch is recorded and answered by
 * `answer`. Call it in beforeEach; vi.unstubAllGlobals() in afterEach undoes it.
 */
export function mockApi(answer: () => ApiAnswer): ApiCall[] {
  const calls: ApiCall[] = [];
  // Node's Request needs an absolute URL; the browser resolves '/api/...' against the page.
  const NodeRequest = globalThis.Request;
  vi.stubGlobal(
    'Request',
    class extends NodeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === 'string' ? new URL(input, 'http://localhost:3000') : input, init);
      }
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // RTK Query passes a Request; plain fetch calls pass a path and options.
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      const text = await request.text();
      const call = {
        method: request.method,
        path: `${url.pathname}${url.search}`,
        body: text ? JSON.parse(text) : undefined,
      };
      calls.push(call);
      return answer()(call);
    }),
  );
  return calls;
}

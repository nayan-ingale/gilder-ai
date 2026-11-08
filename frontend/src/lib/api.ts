/**
 * Calls the app's own /api routes (the Next.js proxy forwards them to the gateway). Errors come
 * back as problem+json; they become an ApiError that keeps the code and the request ID, so the
 * UI can show a clear message and a reference.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

interface Problem {
  code?: string;
  title?: string;
  detail?: string;
  requestId?: string;
}

/** Sends a request to /api{path}. Returns the parsed JSON body, or undefined for 204. */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      headers: {
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach GilderAi. Check your connection.');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const problem = (body ?? {}) as Problem;
    throw new ApiError(
      response.status,
      problem.code ?? 'unknown_error',
      problem.detail ?? problem.title ?? 'Something went wrong',
      problem.requestId ?? response.headers.get('x-request-id') ?? undefined,
    );
  }
  return body as T;
}

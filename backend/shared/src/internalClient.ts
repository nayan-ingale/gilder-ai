import { getContext } from './context.ts';
import { AppError, ERROR_CODES, type ErrorCode } from './errors.ts';
import {
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  type ServiceCaller,
  signInternalToken,
} from './internalToken.ts';
import { REQUEST_ID_HEADER } from './requestId.ts';

/**
 * How one service calls another: a fresh internal token signed with the caller's own key, for
 * the same user and request ID, and a time limit. Errors come back as AppErrors, so a 402 from
 * billing stays a 402 for the caller.
 */

export interface InternalClientOptions {
  /** Who is calling: its name goes in the token, and the receiver checks it with its key. */
  caller: ServiceCaller;
  privateKey: InternalKey;
  /** The service being called: the token's audience. */
  service: string;
  baseUrl: string;
  /** Default 5 seconds. */
  timeoutMs?: number;
}

export interface InternalRequest {
  /** The user the call is for. */
  userId?: string;
  body?: unknown;
  /**
   * Retries once on a network error, a timeout or a 5xx. Only for calls that are safe to repeat,
   * such as the sign-up grant or a reserve with an idempotency key.
   */
  retry?: boolean;
}

export interface InternalClient {
  request<T>(method: string, path: string, options?: InternalRequest): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 200;

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_CODES;
}

export function createInternalClient(options: InternalClientOptions): InternalClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function attempt<T>(method: string, path: string, request: InternalRequest): Promise<T> {
    const requestId = getContext()?.requestId;
    const token = await signInternalToken(
      options.privateKey,
      options.service,
      {
        ...(request.userId ? { userId: request.userId } : {}),
        ...(requestId ? { requestId } : {}),
      },
      60,
      options.caller,
    );

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          [INTERNAL_TOKEN_HEADER]: token,
          ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
          ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AppError('service_unavailable', `${options.service} did not answer`, {
        cause: error,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.ok) {
      return body as T;
    }
    const problem = (body ?? {}) as { code?: unknown; detail?: unknown };
    if (response.status < 500 && isErrorCode(problem.code)) {
      throw new AppError(
        problem.code,
        typeof problem.detail === 'string' ? problem.detail : undefined,
      );
    }
    throw new AppError('service_unavailable', `${options.service} answered ${response.status}`);
  }

  return {
    async request<T>(method: string, path: string, request: InternalRequest = {}): Promise<T> {
      try {
        return await attempt<T>(method, path, request);
      } catch (error) {
        const retryable = error instanceof AppError && error.code === 'service_unavailable';
        if (!request.retry || !retryable) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return attempt<T>(method, path, request);
      }
    },
  };
}

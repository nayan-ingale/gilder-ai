import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request values that every log line written during the request should carry. */
export interface RequestContext {
  requestId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` (and everything it awaits) with `context` as the current request context. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Records the authenticated user on the current request, once it is known. */
export function setContextUserId(userId: string): void {
  const context = storage.getStore();
  if (context) {
    context.userId = userId;
  }
}

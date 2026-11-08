import { ApiError } from './api';
import type { ChatMessage } from './chats';
import { readServerEvents } from './sse';

/**
 * Sending a message and reading the answer as it streams. A refusal (no credits, a duplicate,
 * not your chat) comes back before the stream as problem+json and becomes an ApiError; once the
 * stream starts, everything arrives as events.
 */

export const BUILT_AGENTS = ['chat'] as const;

export type TurnEvent =
  | { event: 'meta'; data: { turnId: string; userMessageId: string; assistantMessageId: string } }
  | { event: 'agent'; data: { agent: string; reason: string } }
  | { event: 'token'; data: { text: string } }
  | { event: 'usage'; data: { creditsCharged: number; balance: number } }
  | { event: 'title'; data: { title: string } }
  | { event: 'error'; data: { code: string; message: string; requestId?: string } }
  | { event: 'done'; data: Record<string, never> };

export type TurnRequest =
  | { kind: 'send'; chatId: string; content: string; clientMessageId: string; agent?: string }
  | { kind: 'regenerate'; chatId: string; messageId: string; clientMessageId: string }
  | {
      kind: 'edit';
      chatId: string;
      messageId: string;
      content: string;
      clientMessageId: string;
      agent?: string;
    };

function pathAndBody(request: TurnRequest): { path: string; body: Record<string, unknown> } {
  const chat = `/api/chats/${encodeURIComponent(request.chatId)}/messages`;
  switch (request.kind) {
    case 'send':
      return {
        path: chat,
        body: {
          content: request.content,
          clientMessageId: request.clientMessageId,
          ...(request.agent ? { agent: request.agent } : {}),
        },
      };
    case 'regenerate':
      return {
        path: `${chat}/${encodeURIComponent(request.messageId)}/regenerate`,
        body: { clientMessageId: request.clientMessageId },
      };
    case 'edit':
      return {
        path: `${chat}/${encodeURIComponent(request.messageId)}/edit`,
        body: {
          content: request.content,
          clientMessageId: request.clientMessageId,
          ...(request.agent ? { agent: request.agent } : {}),
        },
      };
  }
}

/** A fresh ID for one send, so a retried request is answered (and charged) once. */
export function newClientMessageId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export async function* streamTurn(
  request: TurnRequest,
  signal: AbortSignal,
): AsyncGenerator<TurnEvent> {
  const { path, body } = pathAndBody(request);
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    throw new ApiError(
      0,
      'network_error',
      'Could not reach GilderAi. Check your connection.',
      undefined,
      {
        cause: error,
      },
    );
  }

  if (!response.ok || !response.body) {
    const problem = (await response.json().catch(() => ({}))) as {
      code?: string;
      detail?: string;
      title?: string;
      requestId?: string;
    };
    throw new ApiError(
      response.status,
      problem.code ?? 'unknown_error',
      problem.detail ?? problem.title ?? 'Something went wrong',
      problem.requestId ?? response.headers.get('x-request-id') ?? undefined,
    );
  }

  try {
    for await (const event of readServerEvents(response.body, signal)) {
      yield event as TurnEvent;
    }
  } catch (error) {
    if (!signal.aborted) {
      throw error;
    }
  }
}

/** Asks the server to stop an answer; the browser also stops reading. */
export async function stopTurn(turnId: string): Promise<void> {
  await fetch(`/api/turns/${encodeURIComponent(turnId)}/stop`, { method: 'POST' }).catch(
    () => undefined,
  );
}

/** A message shown in the thread: saved ones, plus the one being written. */
export type ThreadMessage = Pick<ChatMessage, 'role' | 'content' | 'status'> & {
  /** A local key until the server's ID is known. */
  key: string;
  id?: string;
  agent?: string | null;
  /** For a failed answer: why, and the request ID to quote. */
  error?: { message: string; requestId?: string };
};

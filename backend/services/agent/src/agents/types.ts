import type { Agent } from '@gilder/shared';
import type { Llm, LlmEvent } from '../llm/llm.ts';
import type { LlmMessage } from '../llm/types.ts';
import type { Source } from '../search/web-search.ts';
import type { GeneratedFile } from '../files/generated.ts';
import type { CodeFile } from './code-files.ts';

/** A file sent with the message, already checked: the user's, ready, and from this chat. */
export interface Attachment {
  fileId: string;
  purpose: 'pdf' | 'image';
  name: string;
  mime: string;
}

/** What every agent gets for one answer. */
export interface AgentContext {
  userId?: string;
  chatId?: string;
  /** Files sent with this message. */
  attachments?: Attachment[];
  /** The user's message, without any shortcut. */
  text: string;
  /** Earlier messages of the chat, oldest first, already trimmed to fit. */
  memory: LlmMessage[];
  llm: Llm;
  signal: AbortSignal;
  /** The answer being written, for telemetry. */
  messageId?: string;
}

/** A passage of a PDF an answer is based on, for [p. N] citations. */
export interface Citation {
  documentId: string;
  name: string;
  page: number;
  quote: string;
}

/** What an agent streams back: the model's events, plus what some agents add. */
export type AgentEvent =
  | LlmEvent
  | { type: 'sources'; items: Source[] }
  | { type: 'artifact'; files: CodeFile[] }
  | { type: 'citations'; items: Citation[] }
  | { type: 'progress'; step: string; current: number; total: number }
  | { type: 'file'; file: GeneratedFile };

export interface AgentRunner {
  name: Agent;
  run(context: AgentContext): AsyncGenerator<AgentEvent>;
}

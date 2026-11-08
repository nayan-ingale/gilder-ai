import type { Agent } from '@gilder/shared';
import type { Llm, LlmEvent } from '../llm/llm.ts';
import type { LlmMessage } from '../llm/types.ts';

/** What every agent gets for one answer. */
export interface AgentContext {
  /** The user's message, without any shortcut. */
  text: string;
  /** Earlier messages of the chat, oldest first, already trimmed to fit. */
  memory: LlmMessage[];
  llm: Llm;
  signal: AbortSignal;
  /** The answer being written, for telemetry. */
  messageId?: string;
}

/** What an agent streams back. Later agents add sources, artifacts and files. */
export type AgentEvent = LlmEvent;

export interface AgentRunner {
  name: Agent;
  run(context: AgentContext): AsyncGenerator<AgentEvent>;
}

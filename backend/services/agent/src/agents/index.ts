import type { Agent } from '@gilder/shared';
import { chatAgent } from './chat.ts';
import type { AgentRunner } from './types.ts';

/** The agents this server runs. The router only picks from these; anything else becomes chat. */
export const AGENT_RUNNERS: Partial<Record<Agent, AgentRunner>> = {
  chat: chatAgent,
};

export const AVAILABLE_AGENTS: ReadonlySet<Agent> = new Set(Object.keys(AGENT_RUNNERS) as Agent[]);

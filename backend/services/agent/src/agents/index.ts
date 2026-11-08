import type { Agent } from '@gilder/shared';
import type { WebSearch } from '../search/web-search.ts';
import { chatAgent } from './chat.ts';
import { codeAgent } from './code.ts';
import { createSearchAgent } from './search.ts';
import type { AgentRunner } from './types.ts';

export interface AgentTools {
  /** Web search; without it the search agent is off. */
  webSearch?: WebSearch | undefined;
}

/** The agents this server runs. The router only picks from these; anything else becomes chat. */
export function buildAgents(tools: AgentTools): Partial<Record<Agent, AgentRunner>> {
  return {
    chat: chatAgent,
    code: codeAgent,
    ...(tools.webSearch ? { search: createSearchAgent(tools.webSearch) } : {}),
  };
}

export function availableAgents(agents: Partial<Record<Agent, AgentRunner>>): ReadonlySet<Agent> {
  return new Set(Object.keys(agents) as Agent[]);
}

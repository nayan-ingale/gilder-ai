import type { Agent } from '@gilder/shared';
import type { WebSearch } from '../search/web-search.ts';
import { chatAgent } from './chat.ts';
import { codeAgent } from './code.ts';
import { createImageQaAgent, type ImageQaTools } from './image-qa.ts';
import { createPdfQaAgent, type PdfQaTools } from './pdf-qa.ts';
import { createSearchAgent } from './search.ts';
import type { AgentRunner } from './types.ts';

export interface AgentTools {
  /** Web search; without it the search agent is off. */
  webSearch?: WebSearch | undefined;
  /** Document search over the chat's PDFs; without it PDF questions are off. */
  pdfQa?: PdfQaTools | undefined;
  /** Reading attached images; without it image questions are off. */
  imageQa?: ImageQaTools | undefined;
}

/** The agents this server runs. The router only picks from these; anything else becomes chat. */
export function buildAgents(tools: AgentTools): Partial<Record<Agent, AgentRunner>> {
  return {
    chat: chatAgent,
    code: codeAgent,
    ...(tools.webSearch ? { search: createSearchAgent(tools.webSearch) } : {}),
    ...(tools.pdfQa ? { pdf_qa: createPdfQaAgent(tools.pdfQa) } : {}),
    ...(tools.imageQa ? { image_qa: createImageQaAgent(tools.imageQa) } : {}),
  };
}

export function availableAgents(agents: Partial<Record<Agent, AgentRunner>>): ReadonlySet<Agent> {
  return new Set(Object.keys(agents) as Agent[]);
}

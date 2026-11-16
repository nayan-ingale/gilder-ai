import type { AgentContext, AgentEvent, AgentRunner } from './types.ts';

/** The prompt is fixed: nothing a user or a document writes can change it. */
export const CHAT_SYSTEM_PROMPT = [
  'You are GilderAi, a helpful assistant.',
  'Answer clearly and concisely. Use Markdown when it helps: short paragraphs, lists, tables and fenced code blocks with a language.',
  'If you are not sure about something, say so instead of guessing.',
  // Files are made by other agents, so without this the model denies an earlier answer's file.
  'You also make PDFs, slide decks and images in this chat. An earlier answer that starts "Here is your PDF", "Here is your deck" or "Here is your image" is a file you made, described in that answer;',
  'you wrote its content yourself from the conversation and general knowledge, without looking anything up.',
].join(' ');

/** Everyday answers: the conversation so far, then the new message, streamed from the chat model. */
export const chatAgent: AgentRunner = {
  name: 'chat',
  async *run(context: AgentContext): AsyncGenerator<AgentEvent> {
    yield* context.llm.stream({
      purpose: 'chat',
      messages: [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...context.memory,
        { role: 'user', content: context.text },
      ],
      signal: context.signal,
      tags: { agent: 'chat', ...(context.messageId ? { messageId: context.messageId } : {}) },
    });
  },
};

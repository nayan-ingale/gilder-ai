import { parseCodeFiles } from './code-files.ts';
import type { AgentContext, AgentEvent, AgentRunner } from './types.ts';

/** The format the code agent writes in, so its files can be parsed afterwards. */
export const CODE_SYSTEM_PROMPT = [
  'You are GilderAi, a senior software engineer. Write complete, working code for the request.',
  'First write one or two sentences on what you built. Then write each file as a level-3 heading with its relative path in backticks, followed by one fenced code block with the language, for example:',
  '### `src/app.ts`',
  '```typescript',
  '// code',
  '```',
  'Use at most 10 files and keep each file under 200 KB. For something a browser can show, include an index.html that loads style.css and script.js by those relative names.',
  'After the files, add a short "How to run" section.',
].join('\n');

/** Code files: streamed as Markdown so the user sees them being written, then sent as files. */
export const codeAgent: AgentRunner = {
  name: 'code',
  async *run(context: AgentContext): AsyncGenerator<AgentEvent> {
    let text = '';
    for await (const event of context.llm.stream({
      purpose: 'code',
      messages: [
        { role: 'system', content: CODE_SYSTEM_PROMPT },
        ...context.memory,
        { role: 'user', content: context.text },
      ],
      signal: context.signal,
      tags: { agent: 'code', ...(context.messageId ? { messageId: context.messageId } : {}) },
    })) {
      if (event.type === 'token') {
        text += event.text;
      }
      yield event;
    }
    const files = parseCodeFiles(text);
    if (files.length > 0) {
      yield { type: 'artifact', files };
    }
  },
};

import { type Agent, createLogger } from '@gilder/shared';
import { describe, expect, it } from 'vitest';
import { createLlm } from './llm/llm.ts';
import { createMockProvider } from './llm/mock.ts';
import { parseShortcut, routeMessage } from './routing.ts';

const logger = createLogger({ service: 'agent', level: 'silent' });
const ALL = new Set<Agent>([
  'chat',
  'search',
  'code',
  'pdf',
  'slides',
  'image',
  'pdf_qa',
  'image_qa',
]);

function routerReplying(reply: string) {
  let calls = 0;
  const llm = createLlm({
    mode: 'mock',
    providers: {
      mock: createMockProvider({
        delayMs: 0,
        respond: () => {
          calls += 1;
          return reply;
        },
      }),
    },
    logger,
  });
  return { llm, calls: () => calls };
}

describe('parseShortcut', () => {
  it('takes a known shortcut off the start of the message', () => {
    expect(parseShortcut('/search  best phones 2026')).toEqual({
      text: 'best phones 2026',
      shortcut: 'search',
    });
    expect(parseShortcut('/CODE a todo app')).toEqual({ text: 'a todo app', shortcut: 'code' });
    expect(parseShortcut('/image')).toEqual({ text: '', shortcut: 'image' });
  });

  it('leaves other text alone', () => {
    for (const text of ['/unknown thing', 'use /search later', 'path/to/file', '/searching']) {
      expect(parseShortcut(text)).toEqual({ text });
    }
  });
});

describe('routeMessage', () => {
  it("follows the user's choice, then an attachment, without asking the model", async () => {
    const { llm, calls } = routerReplying('{"agent":"code","confidence":1}');

    await expect(
      routeMessage({ text: 'x', chosen: 'search', available: ALL }, llm, logger),
    ).resolves.toEqual({ agent: 'search', reason: 'chosen' });
    await expect(
      routeMessage({ text: 'x', attachmentKinds: ['image', 'pdf'], available: ALL }, llm, logger),
    ).resolves.toEqual({ agent: 'pdf_qa', reason: 'attachment' });
    expect(calls()).toBe(0);
  });

  it("uses the model's choice when it is confident", async () => {
    const { llm } = routerReplying('{"agent":"code","confidence":0.92}');

    await expect(
      routeMessage({ text: 'write a sort function', available: ALL }, llm, logger),
    ).resolves.toEqual({ agent: 'code', reason: 'router' });
  });

  it('falls back to chat when unsure, when the reply is invalid, or when the agent is missing', async () => {
    const unsure = routerReplying('{"agent":"search","confidence":0.3}');
    const invalid = routerReplying('{"agent":"pdf_qa","confidence":1}');
    const confident = routerReplying('{"agent":"code","confidence":1}');

    for (const [llm, available] of [
      [unsure.llm, ALL],
      [invalid.llm, ALL],
      [confident.llm, new Set<Agent>(['chat'])],
    ] as const) {
      await expect(routeMessage({ text: 'x', available }, llm, logger)).resolves.toEqual({
        agent: 'chat',
        reason: 'default',
      });
    }
  });
});

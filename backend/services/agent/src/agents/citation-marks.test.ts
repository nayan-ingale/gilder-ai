import { describe, expect, it } from 'vitest';
import type { LlmEvent } from '../llm/llm.ts';
import { plainCitationMarks } from './citation-marks.ts';

async function* tokens(...texts: string[]): AsyncGenerator<LlmEvent> {
  yield { type: 'model', provider: 'mock', model: 'mock' };
  for (const text of texts) {
    yield { type: 'token', text };
  }
  yield { type: 'usage', inputTokens: 1, outputTokens: 2 };
}

async function cleaned(source: AsyncGenerator<LlmEvent>) {
  const events: LlmEvent[] = [];
  for await (const event of plainCitationMarks(source)) {
    events.push(event);
  }
  const text = events.map((event) => (event.type === 'token' ? event.text : '')).join('');
  return { events, text };
}

describe('plainCitationMarks', () => {
  it('turns full-width marks into plain ones, even when a mark is split across tokens', async () => {
    const { text } = await cleaned(tokens('Blue Falcon【p', '. 1】 and', ' 42 lakh【', 'p. 3】.'));

    expect(text).toBe('Blue Falcon[p. 1] and 42 lakh[p. 3].');
  });

  it('drops the † part of a mark up to its closing bracket', async () => {
    const { text } = await cleaned(tokens('Fast【1†sou', 'rce】 and cheap【2†L4-L9】.'));

    expect(text).toBe('Fast[1] and cheap[2].');
  });

  it('never lets an unclosed mark swallow the next line', async () => {
    const { text } = await cleaned(tokens('Odd【1†never closed\n', 'Next line † stays.'));

    expect(text).toBe('Odd[1\nNext line † stays.');
  });

  it('leaves plain text and the other events as they are', async () => {
    const { events, text } = await cleaned(tokens('Already [p. 2] plain.'));

    expect(text).toBe('Already [p. 2] plain.');
    expect(events.map((event) => event.type)).toEqual(['model', 'token', 'usage']);
  });
});

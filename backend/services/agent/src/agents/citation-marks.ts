import type { LlmEvent } from '../llm/llm.ts';

/**
 * Some models cite with full-width brackets whatever the prompt asks: 【p. 2】, 【1】 or
 * 【1†source】. This turns them into the plain [p. 2] and [1] the app shows as page tags and
 * source links, in the streamed and the saved text alike. It works one character at a time, so
 * a mark split across tokens is still fixed; the † part is dropped up to the closing bracket, and
 * a mark never runs past the end of a line.
 */
export async function* plainCitationMarks(
  events: AsyncIterable<LlmEvent>,
): AsyncGenerator<LlmEvent> {
  let inMark = false;
  let dropping = false;
  for await (const event of events) {
    if (event.type !== 'token') {
      yield event;
      continue;
    }
    let text = '';
    for (const char of event.text) {
      if (char === '【') {
        inMark = true;
        dropping = false;
        text += '[';
      } else if (char === '】') {
        inMark = false;
        dropping = false;
        text += ']';
      } else if (char === '\n') {
        inMark = false;
        dropping = false;
        text += char;
      } else if (inMark && char === '†') {
        dropping = true;
      } else if (!dropping) {
        text += char;
      }
    }
    if (text) {
      yield { ...event, text };
    }
  }
}

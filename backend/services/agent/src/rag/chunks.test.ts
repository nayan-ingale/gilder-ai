import { describe, expect, it } from 'vitest';
import { chunkPages } from './chunks.ts';

describe('chunkPages', () => {
  it('keeps each piece on its page and overlaps long pages', () => {
    const long = Array.from({ length: 300 }, (_, index) => `word${index}`).join(' ');

    const chunks = chunkPages(['Short first page.', long], 1_000, 200);

    expect(chunks[0]).toEqual({ page: 1, text: 'Short first page.' });
    const second = chunks.filter((chunk) => chunk.page === 2);
    expect(second.length).toBeGreaterThan(1);
    expect(second.every((chunk) => chunk.text.length <= 1_000)).toBe(true);
    // The next piece starts inside the previous one, so nothing falls between them.
    const tail = second[0]?.text.split(' ').slice(-3).join(' ') ?? '';
    expect(second[1]?.text).toContain(tail);
    // Words are never cut in half.
    expect(second.every((chunk) => /^word\d+( word\d+)*$/.test(chunk.text))).toBe(true);
  });

  it('skips empty pages and squeezes whitespace', () => {
    expect(chunkPages(['', '  a \n\n b  '])).toEqual([{ page: 2, text: 'a b' }]);
  });
});

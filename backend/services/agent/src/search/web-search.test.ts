import { describe, expect, it } from 'vitest';
import { mockWebSearch, toSources } from './web-search.ts';

describe('toSources', () => {
  it('numbers the results, trims them and keeps only web links', () => {
    const sources = toSources(
      [
        {
          title: '  TypeScript 6.0  ',
          url: 'https://devblogs.microsoft.com/ts',
          content: 'x'.repeat(2_000),
        },
        { title: 'Bad link', url: 'javascript:alert(1)', content: 'nope' },
        { title: '', url: 'https://example.com/page', content: 'Untitled page' },
      ],
      ['https://img.example/1.png', 'data:image/png;base64,AAA'],
    );

    expect(sources).toEqual([
      {
        n: 1,
        title: 'TypeScript 6.0',
        url: 'https://devblogs.microsoft.com/ts',
        snippet: 'x'.repeat(700),
        image: 'https://img.example/1.png',
      },
      { n: 2, title: 'example.com', url: 'https://example.com/page', snippet: 'Untitled page' },
    ]);
  });

  it('keeps at most five results', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      title: `r${index}`,
      url: `https://example.com/${index}`,
      content: '',
    }));

    expect(toSources(many).map((source) => source.n)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('mockWebSearch', () => {
  it('returns canned numbered sources mentioning the query', async () => {
    const sources = await mockWebSearch('typescript');

    expect(sources.map((source) => source.n)).toEqual([1, 2]);
    expect(sources[0]?.title).toContain('typescript');
  });
});

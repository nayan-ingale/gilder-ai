// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Citation, Source } from '@/lib/turns';
import { linkCitations, MessageItem, tagPages } from './message-item';

afterEach(() => {
  cleanup();
});

const SOURCES: Source[] = [
  { n: 1, title: 'TypeScript blog', url: 'https://devblogs.microsoft.com/typescript', snippet: '' },
  { n: 2, title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/TypeScript', snippet: '' },
];

describe('linkCitations', () => {
  it('links [n] to its source, leaving unknown numbers, links and code alone', () => {
    const text =
      'Fact [1], more [2][1], none [7], a [link](https://x.dev) and `arr[1]`.\n```\nlist[2]\n```';

    expect(linkCitations(text, SOURCES)).toBe(
      'Fact [\\[1\\]](https://devblogs.microsoft.com/typescript), more [\\[2\\]](https://en.wikipedia.org/wiki/TypeScript)[\\[1\\]](https://devblogs.microsoft.com/typescript), none [7], a [link](https://x.dev) and `arr[1]`.\n```\nlist[2]\n```',
    );
    expect(linkCitations('No sources [1]', undefined)).toBe('No sources [1]');
    expect(linkCitations('Wide 【2】 and 【1†source】', SOURCES)).toBe(
      'Wide [\\[2\\]](https://en.wikipedia.org/wiki/TypeScript) and [\\[1\\]](https://devblogs.microsoft.com/typescript)',
    );
  });
});

const CITATIONS: Citation[] = [
  { documentId: 'd1', name: 'plan.pdf', page: 1, quote: 'Codename: "Blue Falcon".' },
  { documentId: 'd1', name: 'plan.pdf', page: 1, quote: 'Launch:\n14 March 2027' },
];

describe('tagPages', () => {
  it('turns [p. N] and 【p. N】 into page tags with the cited passages, leaving code alone', () => {
    expect(
      tagPages('Blue Falcon [p. 1], wide【p. 1†L2】, unknown [p. 9], `[p. 1]`.', CITATIONS),
    ).toBe(
      'Blue Falcon [p. 1](#page-1 "plan.pdf: Codename: \\"Blue Falcon\\". · plan.pdf: Launch: 14 March 2027"), wide[p. 1](#page-1 "plan.pdf: Codename: \\"Blue Falcon\\". · plan.pdf: Launch: 14 March 2027"), unknown [p. 9](#page-9), `[p. 1]`.',
    );
    expect(tagPages('No citations [p. 1]', undefined)).toBe('No citations [p. 1]');
  });
});

describe('MessageItem', () => {
  it('shows the page marks of a PDF answer as small tags, with the passage on hover', () => {
    render(
      <ol>
        <MessageItem
          message={{
            key: 'a2',
            id: 'a2',
            role: 'assistant',
            content: 'The codename is Blue Falcon [p. 1].',
            status: 'complete',
            agent: 'pdf_qa',
            citations: CITATIONS,
          }}
        />
      </ol>,
    );

    const tag = screen.getByText('p. 1', { selector: 'span' });
    expect(tag.getAttribute('title')).toBe(
      'plan.pdf: Codename: "Blue Falcon". · plan.pdf: Launch: 14 March 2027',
    );
    expect(screen.queryByRole('link', { name: 'p. 1' })).toBeNull();
  });

  it('shows a search answer with clickable citations and its sources', () => {
    render(
      <ol>
        <MessageItem
          message={{
            key: 'a1',
            id: 'a1',
            role: 'assistant',
            content: 'TypeScript 6.0 is out [1].',
            status: 'complete',
            agent: 'search',
            sources: SOURCES,
          }}
        />
      </ol>,
    );

    const citation = screen.getByRole('link', { name: '[1]' });
    expect(citation.getAttribute('href')).toBe('https://devblogs.microsoft.com/typescript');
    const sources = screen.getByRole('region', { name: 'Sources' });
    expect(
      within(sources)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['1devblogs.microsoft.com', '2en.wikipedia.org']);
  });
});

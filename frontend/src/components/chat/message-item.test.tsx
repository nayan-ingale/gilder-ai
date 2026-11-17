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

    const one = '[1](https://devblogs.microsoft.com/typescript "Source 1: TypeScript blog")';
    const two = '[2](https://en.wikipedia.org/wiki/TypeScript "Source 2: Wikipedia")';
    expect(linkCitations(text, SOURCES)).toBe(
      `Fact ${one}, more ${two}${one}, none [7], a [link](https://x.dev) and \`arr[1]\`.\n\`\`\`\nlist[2]\n\`\`\``,
    );
    expect(linkCitations('No sources [1]', undefined)).toBe('No sources [1]');
    expect(linkCitations('Wide 【2】 and 【1†source】', SOURCES)).toBe(`Wide ${two} and ${one}`);
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

    // The citation is a small pill named after its source.
    const citation = screen.getByRole('link', { name: 'Source 1: TypeScript blog' });
    expect(citation.getAttribute('href')).toBe('https://devblogs.microsoft.com/typescript');
    expect(citation.textContent).toBe('1');
    const sources = screen.getByRole('region', { name: 'Sources' });
    expect(
      within(sources)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['1TypeScript blogdevblogs.microsoft.com', '2Wikipediaen.wikipedia.org']);
    // Above the answer: the agent that wrote it.
    expect(screen.getByText('Search')).toBeTruthy();
  });

  it('says what a finished answer cost and how long it took', () => {
    render(
      <ol>
        <MessageItem
          message={{
            key: 'a2',
            id: 'a2',
            role: 'assistant',
            content: 'Hello.',
            status: 'complete',
            agent: 'chat',
            credits: 1,
            latencyMs: 3_240,
          }}
        />
      </ol>,
    );

    expect(screen.getByText('1 credit · answered in 3.2 s')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });
});

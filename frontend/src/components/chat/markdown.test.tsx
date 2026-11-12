// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Markdown, splitBlocks } from './markdown';

// Counts code highlighting, to see which blocks are rendered again.
const highlighted = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/lib/highlight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/highlight')>();
  return {
    ...actual,
    highlightCode: (...args: Parameters<typeof actual.highlightCode>) => {
      highlighted.count += 1;
      return actual.highlightCode(...args);
    },
  };
});

describe('splitBlocks', () => {
  it('splits at top-level blocks and keeps every character', () => {
    const text = '# Title\n\nFirst paragraph.\n\n- one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n';

    const blocks = splitBlocks(text);

    expect(blocks).toEqual([
      '# Title\n\n',
      'First paragraph.\n\n',
      '- one\n- two\n\n',
      '| a | b |\n| - | - |\n| 1 | 2 |\n',
    ]);
    expect(blocks.join('')).toBe(text);
  });

  it('never splits a code block or a list item at a blank line', () => {
    const code = '```js\nconst a = 1;\n\nconst b = 2;\n```\n\n';
    const item = '- item\n\n  more of the same item\n';

    expect(splitBlocks(`Intro\n\n${code}${item}`)).toEqual(['Intro\n\n', code, item]);
  });

  it('keeps text with reference links whole, since they point across blocks', () => {
    const text = 'See [the docs][1].\n\nMore.\n\n[1]: https://example.com\n';

    expect(splitBlocks(text)).toEqual([text]);
  });
});

describe('Markdown while streaming', () => {
  it('renders only the block that changed, not the finished ones above it', () => {
    const start = '```js\nconst a = 1;\n```\n\nThe answer';
    const { rerender } = render(<Markdown>{start}</Markdown>);
    const afterFirstRender = highlighted.count;

    rerender(<Markdown>{`${start} keeps`}</Markdown>);
    rerender(<Markdown>{`${start} keeps growing.`}</Markdown>);

    expect(afterFirstRender).toBeGreaterThan(0);
    expect(highlighted.count).toBe(afterFirstRender);
    expect(screen.getByText('The answer keeps growing.')).toBeTruthy();
  });
});

afterEach(() => {
  cleanup();
});

describe('Markdown', () => {
  it('shows a model-written image as a link, never loading it (SEC-10)', () => {
    const { container } = render(
      <Markdown>{'Look: ![a cat](https://evil.example/pixel.png)'}</Markdown>,
    );

    expect(container.querySelector('img')).toBeNull();
    const link = screen.getByRole('link', { name: 'Image: a cat' });
    expect(link.getAttribute('href')).toBe('https://evil.example/pixel.png');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
  });

  it('shows raw HTML as text and drops javascript links', () => {
    const { container } = render(
      <Markdown>{'<script>alert(1)</script> <b>bold?</b> [click](javascript:alert(1))'}</Markdown>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toContain('javascript');
  });

  it('renders lists, tables and code blocks with a copy button', () => {
    const { container } = render(
      <Markdown>
        {'- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```'}
      </Markdown>,
    );

    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('table td')?.textContent).toBe('1');
    expect(screen.getByText('ts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(container.querySelector('a[href^="https://"]')).toBeNull();
  });

  it('opens links in a new tab without access to this page', () => {
    render(<Markdown>{'[docs](https://example.com)'}</Markdown>);

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});

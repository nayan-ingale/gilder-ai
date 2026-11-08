import { describe, expect, it } from 'vitest';
import { highlightCode } from './highlight';

describe('highlightCode', () => {
  it('colours known languages and escapes the code itself', () => {
    const html = highlightCode('const tag = "<img src=x onerror=alert(1)>";', 'ts') ?? '';

    expect(html).toContain('hljs-keyword');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('leaves unknown languages to plain text', () => {
    expect(highlightCode('x', 'brainfuck')).toBeNull();
    expect(highlightCode('x', undefined)).toBeNull();
  });
});

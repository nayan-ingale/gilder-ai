import { describe, expect, it } from 'vitest';
import { MAX_FILES, parseCodeFiles } from './code-files.ts';

describe('parseCodeFiles', () => {
  it('reads each path heading and its code block, with the language', () => {
    const markdown = [
      'A small page.',
      '',
      '### `index.html`',
      '```html',
      '<h1>Hi</h1>',
      '```',
      '',
      '### src/app.ts',
      '```',
      'export const x = 1;',
      '```',
      '',
      '## How to run',
      'Open index.html.',
    ].join('\n');

    expect(parseCodeFiles(markdown)).toEqual([
      { name: 'index.html', language: 'html', content: '<h1>Hi</h1>' },
      { name: 'src/app.ts', language: 'typescript', content: 'export const x = 1;' },
    ]);
  });

  it('skips unsafe paths, keeps the last copy of a name, and caps the count', () => {
    const block = (name: string, body = 'x') => `### \`${name}\`\n\`\`\`txt\n${body}\n\`\`\``;
    const markdown = [
      block('../etc/passwd'),
      block('/abs/path.txt'),
      block('C:\\\\win.txt'),
      block('ok.txt', 'first'),
      block('ok.txt', 'second'),
      ...Array.from({ length: 15 }, (_, index) => block(`f${index}.txt`)),
    ].join('\n\n');

    const files = parseCodeFiles(markdown);

    expect(files.map((file) => file.name)).not.toContain('../etc/passwd');
    expect(files.find((file) => file.name === 'ok.txt')?.content).toBe('second');
    expect(files.every((file) => !file.name.startsWith('/'))).toBe(true);
    expect(files).toHaveLength(MAX_FILES);
  });

  it('finds nothing in an answer without file headings', () => {
    expect(parseCodeFiles('Just text, and ```js\ncode()\n``` without a heading.')).toEqual([]);
  });
});

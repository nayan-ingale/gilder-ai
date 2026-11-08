import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type CodeFile, previewDocument, zipFiles } from './code-files';

const page: CodeFile[] = [
  {
    name: 'index.html',
    language: 'html',
    content:
      '<html><head><link rel="stylesheet" href="style.css"><link rel="icon" href="https://evil.example/x.ico"></head><body><h1>Hi</h1><script src="./script.js"></script><script src="https://cdn.example/lib.js"></script></body></html>',
  },
  { name: 'style.css', language: 'css', content: 'h1 { color: red; }' },
  { name: 'script.js', language: 'javascript', content: 'const s = "</script>"; console.log(s);' },
];

describe('previewDocument', () => {
  it('puts local CSS and JS inline, drops remote files, and blocks the network', () => {
    const html = previewDocument(page) ?? '';

    expect(html).toContain('<style>h1 { color: red; }</style>');
    expect(html).toContain('console.log(s);');
    expect(html).not.toContain('evil.example');
    expect(html).not.toContain('cdn.example');
    expect(html).toContain("default-src 'none'");
    // A "</script>" inside the script can't close the tag early.
    expect(html).toContain('"<\\/script>"');
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<style>'));
  });

  it('has nothing to preview without an HTML file', () => {
    expect(
      previewDocument([{ name: 'main.py', language: 'python', content: 'print(1)' }]),
    ).toBeNull();
  });
});

describe('zipFiles', () => {
  it('packs every file under its path', async () => {
    const zip = zipFiles([
      ...page,
      { name: 'src/app.ts', language: 'typescript', content: 'export {};' },
    ]);

    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(entries).sort()).toEqual([
      'index.html',
      'script.js',
      'src/app.ts',
      'style.css',
    ]);
    expect(strFromU8(entries['src/app.ts'] ?? new Uint8Array())).toBe('export {};');
  });
});

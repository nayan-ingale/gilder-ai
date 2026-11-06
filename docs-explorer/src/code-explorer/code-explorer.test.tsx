// Renders the code explorer's views against the real docs and code index, to static HTML.
// Effects (scrolling, loading the code) don't run, which is fine for checking the content.
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CodePage } from '../pages/CodePage.tsx';
import { paths } from '../routes.ts';
import { buildCodeTree } from './code-tree.ts';
import { CodeTree } from './CodeTree.tsx';
import { FileDetails } from './FileDetails.tsx';

const HEALTH = 'backend/shared/src/health.ts';
const ROUTER = `${HEALTH}#healthRouter`;
const tree = buildCodeTree();
const SHARED = tree.apps.find((app) => app.app === 'shared')?.title ?? '';
const HEALTH_SYMBOLS = `aria-label="Symbols in src/health.ts, ${SHARED}"`;

function render(element: ReactElement, url = paths.code()): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The opening tag of the first element carrying `attribute` (exact text). */
function tagWith(html: string, attribute: string): string {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<[a-z]+\\b[^>]*${escaped}[^>]*>`).exec(html)?.[0] ?? '';
}

/** A link's href as paths.code writes it, with `&` escaped the way HTML has it. */
function href(to: string): string {
  return `href="${to.replaceAll('&', '&amp;')}"`;
}

describe('CodeTree', () => {
  it('lists every file, with symbols hidden until a file is opened', () => {
    const html = render(<CodeTree tree={tree} />);
    expect(html).toContain('Filter files and functions');
    expect(html).toContain(href(paths.code({ file: HEALTH })));
    expect(tagWith(html, HEALTH_SYMBOLS)).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-current');
  });

  it('gives every file link and button its own name, even where paths repeat across apps', () => {
    const html = render(<CodeTree tree={tree} />);
    const buttonNames = [...html.matchAll(/<button\b[^>]*aria-label="(Symbols in [^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(buttonNames.length).toBeGreaterThan(0);
    expect(new Set(buttonNames).size).toBe(buttonNames.length);

    const fileLinkNames = [
      ...html.matchAll(/<a\b[^>]*href="\/code\?file=[^"&]*"[^>]*>(.*?)<\/a>/g),
    ].map((match) => (match[1] ?? '').replace(/<[^>]+>/g, ''));
    expect(fileLinkNames).toHaveLength(tree.fileCount);
    expect(new Set(fileLinkNames).size).toBe(tree.fileCount);
    expect(fileLinkNames).toContain('src/index.ts, Gateway');
  });

  it('reads nothing out before any typing', () => {
    const html = render(<CodeTree tree={tree} />);
    expect(html).toContain('<p role="status" class="sr-only"></p>');
  });

  it('opens and marks the file of the selected symbol', () => {
    const html = render(<CodeTree tree={tree} activeFile={HEALTH} activeSymbol={ROUTER} />);
    expect(tagWith(html, `${HEALTH_SYMBOLS} title=`)).toContain('aria-expanded="true"');
    expect(tagWith(html, href(paths.code({ file: HEALTH, symbol: ROUTER })))).toContain(
      'aria-current="page"',
    );
    expect(tagWith(html, href(paths.code({ file: HEALTH })))).toContain('aria-current="true"');
    expect(html).toContain('GET /healthz, GET /readyz');
  });
});

describe('FileDetails', () => {
  it('shows the file, its symbols, routes, flows and source', () => {
    const html = render(<FileDetails path={HEALTH} />);
    expect(html).toContain(HEALTH);
    expect(html).toContain('Shared library');
    expect(html).toContain('healthRouter');
    expect(html).toContain(href(paths.flow('health-check')));
    expect(html).toContain(href(paths.flow('readiness-check')));
    expect(html).toContain('Used in flows');
    expect(html).toContain('Lines 1–');
  });

  it('says so when the file is not in the code index', () => {
    const html = render(<FileDetails path="nope/missing.ts" />);
    expect(html).toContain('This file isn&#x27;t in the code index');
    expect(html).toContain('nope/missing.ts');
  });
});

describe('CodePage', () => {
  it('opens the selected file in the panel and marks it in the tree', () => {
    const html = render(<CodePage />, paths.code({ file: HEALTH }));
    expect(html).toContain(`aria-label="Details: ${HEALTH}"`);
    expect(html).toContain('Used in flows');
    expect(tagWith(html, href(paths.code({ file: HEALTH })))).toContain('aria-current="page"');
  });

  it('opens a symbol linked without its file, and opens that file in the tree', () => {
    const html = render(<CodePage />, paths.code({ symbol: ROUTER }));
    expect(html).toContain('aria-label="Details: healthRouter"');
    expect(html).toContain('Function details');
    expect(tagWith(html, `${HEALTH_SYMBOLS} title=`)).toContain('aria-expanded="true"');
    expect(tagWith(html, href(paths.code({ file: HEALTH, symbol: ROUTER })))).toContain(
      'aria-current="page"',
    );
  });

  it('shows no panel when nothing is selected', () => {
    const html = render(<CodePage />);
    expect(html).toContain('aria-label="Details: nothing selected"');
    expect(html).toContain('Code Explorer');
  });
});

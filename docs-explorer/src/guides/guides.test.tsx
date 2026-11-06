// Renders the docs page views to static HTML: a made-up page with every kind of block and ref,
// the real pages, Error Handling, the sidebar's Docs group and the "In the docs" back-links,
// in the detail panel and on a flow's page. Effects (scrolling to a section) don't run, which is
// fine for checking the content.
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ERROR_FLOWS_SECTION_ID, type DocPage } from '../data/schema.ts';
import { RichText } from '../details/RichText.tsx';
import { Sidebar } from '../layout/Sidebar.tsx';
import { createGuidesModel } from '../model/guides.ts';
import { docs, guides } from '../model/index.ts';
import { FlowListPage } from '../pages/FlowListPage.tsx';
import { FlowPage } from '../pages/FlowPage.tsx';
import { GuidePage } from '../pages/GuidePage.tsx';
import { paths } from '../routes.ts';
import { DocsBackLinks } from './DocsBackLinks.tsx';
import { pagePath } from './guide-links.ts';
import { isTypeDefinitions } from './packages.ts';
import { GuideView } from './GuideView.tsx';

function render(element: ReactElement, url = '/docs/fixture'): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/docs/:pageId" element={element} />
        <Route path="/flows/:flowId" element={element} />
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The visible text: tags dropped, and the escapes React adds to static HTML undone. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ');
}

/** A link's href as `paths` writes it, with `&` escaped the way HTML has it. */
function href(to: string): string {
  return `href="${to.replaceAll('&', '&amp;')}"`;
}

const count = (html: string, pattern: RegExp): number => [...html.matchAll(pattern)].length;

/** How many times exact text appears. */
const times = (html: string, needle: string): number => html.split(needle).length - 1;

/** The names of the scrolling frames screen readers list as landmarks, in page order. */
function regionNames(html: string): string[] {
  return [...html.matchAll(/<[^>]*\brole="region"[^>]*>/g)].map(
    ([tag]) => /aria-label="([^"]*)"/.exec(tag)?.[1] ?? '',
  );
}

const HEALTH = 'backend/shared/src/health.ts';
const ROUTER = `${HEALTH}#healthRouter` as const;

const fixture: DocPage = {
  id: 'fixture',
  title: 'Made-up guide',
  summary: 'A page with `every` kind of block.',
  sections: [
    {
      id: 'intro',
      title: 'Introduction',
      status: 'verified',
      blocks: [
        { kind: 'text', text: 'Uses `pino` for logs.' },
        { kind: 'list', items: ['First point', 'Second point'] },
        {
          kind: 'fields',
          fields: [
            { label: 'Decision', text: 'One logger per app.' },
            { label: 'Trade-off', text: 'More setup.' },
          ],
        },
      ],
      refs: [
        { component: 'gateway' },
        { flow: 'health-check' },
        { symbol: ROUTER },
        { file: HEALTH },
        { file: 'backend/docker-compose.yml' },
        { component: 'no-such-part' },
        { component: 'gateway' },
      ],
    },
    {
      id: 'levels',
      title: 'Log levels',
      status: 'inferred',
      blocks: [
        { kind: 'table', columns: ['Level', 'When'], rows: [['info', 'Normal `events`']] },
        { kind: 'quote', file: HEALTH, text: 'healthRouter', caption: 'Where it starts' },
        { kind: 'quote', file: 'backend/docker-compose.yml', text: 'services:' },
      ],
    },
    {
      id: 'later',
      title: 'Tracing',
      status: 'planned',
      plannedIn: 'Observability',
      blocks: [],
    },
  ],
};

describe('GuideView', () => {
  const html = render(<GuideView page={fixture} />);
  const visible = text(html);

  it('shows the title once, the summary, and a page title for the tab', () => {
    expect(count(html, /<h1\b/g)).toBe(1);
    expect(html).toContain('<title>Made-up guide · GilderAi Docs</title>');
    expect(visible).toContain('A page with every kind of block.');
  });

  it('lists the sections, each a link to its section', () => {
    for (const section of fixture.sections) {
      expect(html).toContain(href(paths.doc('fixture', section.id)));
      expect(html).toContain(`id="doc-section-${section.id}"`);
    }
    expect(visible).toContain('On this page');
  });

  it('shows a status only for sections that are not verified, with what adds a planned one', () => {
    expect(count(html, /rounded-full border border-line px-2/g)).toBe(2);
    expect(visible).toContain('Inferred');
    expect(visible).toContain('Planned · Observability');
    expect(visible).not.toContain('Verified');
  });

  it('renders every kind of block', () => {
    expect(html).toContain(
      '<code class="font-mono text-[0.9em] text-fg wrap-anywhere">pino</code>',
    );
    expect(visible).toContain('Second point');
    expect(visible).toMatch(/Decision One logger per app\. Trade-off More setup\./);
    expect(html).toContain('<th scope="col"');
    expect(visible).toContain('Normal events');
    expect(visible).toContain('Where it starts');
    expect(html).toContain('<code>services:</code>');
  });

  it('names each table and quote after its section, so no two landmarks share a name', () => {
    expect(regionNames(html)).toEqual([
      'Log levels, table',
      `Log levels: quoted from ${HEALTH}`,
      'Log levels: quoted from backend/docker-compose.yml',
    ]);
  });

  it('numbers two quotes from the same file in one section', () => {
    const quote = { kind: 'quote', file: HEALTH } as const;
    const page: DocPage = {
      ...fixture,
      sections: [
        {
          id: 'twice',
          title: 'Twice',
          status: 'verified',
          blocks: [
            { ...quote, text: 'healthRouter' },
            { ...quote, text: 'readiness' },
          ],
        },
      ],
    };
    expect(regionNames(render(<GuideView page={page} />))).toEqual([
      `Twice: quoted from ${HEALTH} (1 of 2)`,
      `Twice: quoted from ${HEALTH} (2 of 2)`,
    ]);
  });

  it('opens an indexed quoted file in the code explorer and shows any other as its path', () => {
    expect(times(html, href(paths.code({ file: HEALTH })))).toBe(2);
    expect(html).not.toContain('href="/code?file=backend%2Fdocker-compose.yml"');
    expect(visible).toContain('backend/docker-compose.yml');
  });

  it('links each ref in the map to where the explorer shows it, once', () => {
    expect(visible).toMatch(/In the map Parts .* Flows .* Code .* Files /);
    expect(times(html, href(paths.architecture('system', 'gateway')))).toBe(1);
    expect(html).toContain(href(paths.flow('health-check')));
    expect(html).toContain(href(paths.code({ symbol: ROUTER, file: HEALTH })));
    expect(visible).toContain('no-such-part');
    expect(html).not.toContain('no-such-part"');
  });

  it('says when a page has no sections yet', () => {
    const empty = text(render(<GuideView page={{ ...fixture, sections: [] }} />));
    expect(empty).toContain('Nothing written here yet');
    expect(empty).not.toContain('On this page');
  });

  it('leaves out the list of sections when there is only one', () => {
    const [first] = fixture.sections;
    if (!first) throw new Error('fixture has no sections');
    expect(text(render(<GuideView page={{ ...fixture, sections: [first] }} />))).not.toContain(
      'On this page',
    );
  });
});

describe('the package table', () => {
  const page: DocPage = {
    id: 'stack',
    title: 'Stack',
    summary: '',
    sections: [
      { id: 'packages', title: 'Packages', status: 'verified', blocks: [{ kind: 'packages' }] },
    ],
  };
  const html = render(<GuideView page={page} />);
  // Names read whole without the break points after `/`.
  const names = html.replaceAll('<wbr/>', '');

  it('lists every installed package, with the type definitions folded away', () => {
    for (const entry of guides.packages) expect(names, entry.name).toContain(`>${entry.name}<`);
    const folded = /<details\b.*?<\/details>/s.exec(names)?.[0] ?? '';
    for (const entry of guides.packages.filter((item) => isTypeDefinitions(item.name))) {
      expect(folded, entry.name).toContain(`>${entry.name}<`);
    }
  });

  it('lets a scoped name wrap only after its slash', () => {
    const scoped = guides.packages.filter((entry) => entry.name.includes('/'));
    if (scoped.length === 0) throw new Error('the package list has no scoped packages');
    for (const { name } of scoped) {
      expect(html, name).toContain(`>${name.replaceAll('/', '/<wbr/>')}<`);
    }
  });

  it('lists the planned tools with what adds them', () => {
    for (const tool of guides.plannedTools) {
      expect(text(html)).toContain(tool.name);
      expect(text(html)).toContain(tool.plannedIn);
    }
  });
});

describe('GuidePage', () => {
  it('shows each docs page at its address', () => {
    for (const page of guides.docsPages) {
      const html = render(<GuidePage />, paths.doc(page.id));
      expect(html).toContain(`<title>${page.title} · GilderAi Docs</title>`);
    }
  });

  it('shows the not-found page for an unknown page', () => {
    expect(text(render(<GuidePage />, '/docs/no-such-page'))).toContain('Page not found');
  });

  it('gives every landmark on each page a name of its own', () => {
    const pages = [
      ...guides.docsPages.map((page) => render(<GuidePage />, paths.doc(page.id))),
      render(<FlowListPage category="errors" />, paths.errors()),
    ];
    for (const html of pages) {
      const names = regionNames(html);
      expect(names.every((name) => name !== '')).toBe(true);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('Error Handling', () => {
  const html = render(<FlowListPage category="errors" />, paths.errors());
  const page = guides.pageForSection('errors');
  const sections = page?.sections ?? [];

  it('keeps a single page title above the docs sections and the flows', () => {
    expect(count(html, /<h1\b/g)).toBe(1);
    expect(text(html)).toContain('Error Handling');
    for (const section of sections) {
      expect(html).toContain(`id="doc-section-${section.id}"`);
      expect(html).toContain(href(paths.errors(section.id)));
    }
  });

  it("opens with the error-handling page's summary", () => {
    if (!page) throw new Error('no docs page is shown under Error Handling');
    const intro = /<h1\b.*?<\/h1>\s*<p\b[^>]*>(.*?)<\/p>/s.exec(html)?.[1];
    expect(intro).toBe(renderToStaticMarkup(<RichText text={page.summary} />));
  });

  it('lists the error flows last, as a section of their own the contents link to', () => {
    if (sections.length === 0) throw new Error('the error-handling page has no sections');
    expect(html).toContain(href(paths.errors(ERROR_FLOWS_SECTION_ID)));
    const flows = html.indexOf(`id="doc-section-${ERROR_FLOWS_SECTION_ID}"`);
    expect(flows).toBeGreaterThan(-1);
    expect(flows).toBe(html.lastIndexOf('id="doc-section-'));
  });
});

describe('the sidebar', () => {
  it('lists the docs pages under Docs and marks the open one', () => {
    const [first, ...rest] = guides.docsPages;
    if (!first) throw new Error('no docs pages are listed under Docs');
    const html = render(<Sidebar />, paths.doc(first.id));
    expect(text(html)).toContain('Docs');
    expect(html).toContain(`aria-current="page" class`);
    const current = /<a\b[^>]*aria-current="page"[^>]*>/.exec(html)?.[0] ?? '';
    expect(current).toContain(href(paths.doc(first.id)));
    for (const page of rest) expect(html).toContain(href(paths.doc(page.id)));
    expect(count(html, /aria-current=/g)).toBe(1);
  });
});

describe('DocsBackLinks', () => {
  const model = createGuidesModel(
    {
      pages: [
        fixture,
        {
          id: 'error-handling',
          title: 'Error handling',
          summary: '',
          section: 'errors',
          sections: [
            {
              id: 'shape',
              title: 'Shape',
              status: 'verified',
              blocks: [],
              refs: [{ file: HEALTH }],
            },
          ],
        },
      ],
      packageNotes: [],
      plannedTools: [],
    },
    { packages: [] },
  );

  it('links each docs section about the thing, grouped under its page', () => {
    const html = render(<DocsBackLinks about={{ file: HEALTH }} model={model} />, paths.code());
    expect(text(html)).toMatch(/In the docs 2 .*Made-up guide Introduction .*Error handling Shape/);
    expect(html).toContain(href(paths.doc('fixture', 'intro')));
    expect(html).toContain(href(paths.errors('shape')));
  });

  it('shows nothing when no section is about it', () => {
    expect(render(<DocsBackLinks about={{ flow: 'nope' }} model={model} />, paths.code())).toBe('');
  });

  it('folds the links under a page summary in the header layout', () => {
    const html = render(
      <DocsBackLinks about={{ file: HEALTH }} layout="header" model={model} />,
      paths.code(),
    );
    expect(html).toMatch(/^<details\b/);
    expect(text(html)).toMatch(/In the docs 2 .*Made-up guide Introduction .*Error handling Shape/);
    expect(html).toContain(href(paths.errors('shape')));
  });
});

describe("a flow's page", () => {
  /** The flow most docs sections are about. */
  const [flow] = [...docs.flows].sort(
    (a, b) =>
      guides.sectionsAbout({ flow: b.id }).length - guides.sectionsAbout({ flow: a.id }).length,
  );

  it('links the docs sections about the flow', () => {
    if (!flow) throw new Error('the docs have no flows');
    const usages = guides.sectionsAbout({ flow: flow.id });
    if (usages.length === 0) throw new Error('no docs section is about any flow');
    const html = render(<FlowPage />, paths.flow(flow.id));
    expect(text(html)).toContain(`In the docs ${usages.length}`);
    for (const { page, section } of usages) {
      expect(html, section.id).toContain(href(pagePath(page, section.id)));
    }
  });
});

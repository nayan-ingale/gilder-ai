import { describe, expect, it } from 'vitest';
import type { ArchComponent, DocPage, DocsData, Flow } from '../data/schema.ts';
import type { IndexedSymbol, SourceIndex, SymbolKind } from '../data/source-index.ts';
import { createDocsModel } from '../model/docs-model.ts';
import { buildBreadcrumbs } from './breadcrumbs.ts';

function symbol(id: string, kind: SymbolKind = 'function'): IndexedSymbol {
  return {
    id,
    name: id.split('#')[1] ?? id,
    kind,
    exported: true,
    startLine: 1,
    endLine: 2,
    calls: [],
    calledBy: [],
    externalCalls: [],
    routes: [],
  };
}

const index: SourceIndex = {
  files: [
    {
      path: 'backend/shared/src/health.ts',
      app: 'shared',
      language: 'ts',
      lineCount: 10,
      symbols: [symbol('backend/shared/src/health.ts#healthRouter')],
    },
    {
      path: 'backend/gateway/src/index.ts',
      app: 'gateway',
      language: 'ts',
      lineCount: 10,
      symbols: [symbol('backend/gateway/src/index.ts#(module)', 'module')],
    },
  ],
};

const gateway: ArchComponent = {
  id: 'gateway',
  name: 'Gateway',
  kind: 'app',
  status: 'verified',
  summary: '',
  responsibilities: [],
  path: 'backend/gateway',
};

const ready: Flow = {
  id: 'readiness-check',
  title: 'GET /readyz',
  category: 'api',
  route: { method: 'GET', path: '/readyz' },
  apps: ['gateway'],
  summary: '',
  status: 'verified',
  steps: [
    {
      id: 'caller',
      title: 'A caller asks',
      kind: 'trigger',
      status: 'verified',
      what: '',
      why: '',
    },
    {
      id: 'checks',
      title: 'Run the checks',
      kind: 'handler',
      status: 'verified',
      what: '',
      why: '',
    },
  ],
};

const failure: Flow = {
  ...ready,
  id: 'error-handling',
  title: 'Error → problem+json',
  category: 'errors',
  route: undefined,
};

const data: DocsData = { components: [gateway], links: [], flows: [ready, failure], notes: [] };
const model = createDocsModel(index, data);

const logging: DocPage = { id: 'logging', title: 'Logging', summary: '', sections: [] };
const guidesModel = { getPage: (id: string) => (id === logging.id ? logging : undefined) };

function query(values: Record<string, string>): string {
  return `?${new URLSearchParams(values).toString()}`;
}

describe('buildBreadcrumbs', () => {
  it('shows just the section on top-level pages', () => {
    expect(buildBreadcrumbs('/', '', model)).toEqual([{ label: 'Project Overview', to: '/' }]);
    expect(buildBreadcrumbs('/errors', '', model)).toEqual([
      { label: 'Error Handling', to: '/errors' },
    ]);
    expect(buildBreadcrumbs('/jobs', '', model)).toEqual([
      { label: 'Background Jobs', to: '/jobs' },
    ]);
    // The section of the error-handling docs to scroll to is not a level of its own.
    expect(buildBreadcrumbs('/errors', '?section=shape', model)).toEqual([
      { label: 'Error Handling', to: '/errors' },
    ]);
  });

  it('adds the selected component on an architecture page', () => {
    expect(buildBreadcrumbs('/architecture/backend', '?node=gateway', model)).toEqual([
      { label: 'Backend Architecture', to: '/architecture/backend' },
      { label: 'Gateway', to: '/architecture/backend?node=gateway' },
    ]);
  });

  it('follows a flow down to its step and the open symbol', () => {
    const search = query({ step: 'checks', symbol: 'backend/shared/src/health.ts#healthRouter' });
    expect(buildBreadcrumbs('/flows/readiness-check', search, model)).toEqual([
      { label: 'API Explorer', to: '/flows' },
      { label: 'GET /readyz', to: '/flows/readiness-check' },
      { label: 'Run the checks', to: '/flows/readiness-check?step=checks' },
      { label: 'healthRouter', to: `/flows/readiness-check${search}` },
    ]);
  });

  it('puts an error flow under Error Handling', () => {
    expect(buildBreadcrumbs('/flows/error-handling', '', model)).toEqual([
      { label: 'Error Handling', to: '/errors' },
      { label: 'Error → problem+json', to: '/flows/error-handling' },
    ]);
  });

  it('names top-level code after its file', () => {
    const search = query({ node: 'gateway', symbol: 'backend/gateway/src/index.ts#(module)' });
    expect(buildBreadcrumbs('/architecture/system', search, model).at(-1)?.label).toBe(
      'index.ts (top level)',
    );
  });

  it('shows ids the docs do not know as they are', () => {
    const search = query({ node: 'ghost', symbol: 'backend/x.ts#missing' });
    expect(
      buildBreadcrumbs('/architecture/system', search, model).map((crumb) => crumb.label),
    ).toEqual(['System Architecture', 'ghost', 'missing']);
  });

  it('marks unknown pages and flows as not found', () => {
    expect(buildBreadcrumbs('/nope', '', model)).toEqual([
      { label: 'Page not found', to: '/nope' },
    ]);
    expect(buildBreadcrumbs('/architecture/nope', '', model)).toEqual([
      { label: 'Page not found', to: '/architecture/nope' },
    ]);
    expect(buildBreadcrumbs('/flows/nope', '?step=x', model)).toEqual([
      { label: 'API Explorer', to: '/flows' },
      { label: 'Page not found', to: '/flows/nope?step=x' },
    ]);
  });

  it('shows the open file and symbol in the code explorer', () => {
    expect(buildBreadcrumbs('/code', '', model)).toEqual([{ label: 'Code Explorer', to: '/code' }]);

    // Inside an app's folder, the file is named by its path there.
    const file = 'backend/gateway/src/index.ts';
    expect(buildBreadcrumbs('/code', query({ file }), model)).toEqual([
      { label: 'Code Explorer', to: '/code' },
      { label: 'src/index.ts', to: `/code${query({ file })}` },
    ]);

    // Outside any known folder, by its full path.
    const search = query({
      file: 'backend/shared/src/health.ts',
      symbol: 'backend/shared/src/health.ts#healthRouter',
    });
    expect(buildBreadcrumbs('/code', search, model)).toEqual([
      { label: 'Code Explorer', to: '/code' },
      {
        label: 'backend/shared/src/health.ts',
        to: `/code${query({ file: 'backend/shared/src/health.ts' })}`,
      },
      { label: 'healthRouter', to: `/code${search}` },
    ]);
  });

  it("takes the file from the open symbol when the code explorer's ?file= is missing or stale", () => {
    const symbol = 'backend/gateway/src/index.ts#(module)';
    const labels = (search: string) =>
      buildBreadcrumbs('/code', search, model).map((crumb) => crumb.label);
    const expected = ['Code Explorer', 'src/index.ts', 'index.ts (top level)'];
    expect(labels(query({ symbol }))).toEqual(expected);
    expect(labels(query({ file: 'backend/shared/src/health.ts', symbol }))).toEqual(expected);
  });

  it('shows a file or symbol the code index does not know as it is', () => {
    expect(
      buildBreadcrumbs('/code', query({ file: 'nope.ts', symbol: 'nope.ts#ghost' }), model).map(
        (crumb) => crumb.label,
      ),
    ).toEqual(['Code Explorer', 'nope.ts', 'ghost']);
    expect(
      buildBreadcrumbs('/code', query({ symbol: 'nope.ts#ghost' }), model).map(
        (crumb) => crumb.label,
      ),
    ).toEqual(['Code Explorer', 'ghost']);
  });

  it('shows a docs page under Docs, which is a group and not a link', () => {
    expect(buildBreadcrumbs('/docs/logging', '', model, guidesModel)).toEqual([
      { label: 'Docs' },
      { label: 'Logging', to: '/docs/logging' },
    ]);
    // A section to scroll to is not a level of its own.
    expect(buildBreadcrumbs('/docs/logging', '?section=levels', model, guidesModel)).toEqual([
      { label: 'Docs' },
      { label: 'Logging', to: '/docs/logging' },
    ]);
  });

  it('marks an unknown docs page as not found', () => {
    expect(buildBreadcrumbs('/docs/nope', '?section=x', model, guidesModel)).toEqual([
      { label: 'Docs' },
      { label: 'Page not found', to: '/docs/nope?section=x' },
    ]);
    expect(buildBreadcrumbs('/docs', '', model, guidesModel)).toEqual([
      { label: 'Page not found', to: '/docs' },
    ]);
  });

  it('ignores a selection on pages that have nothing to select', () => {
    expect(buildBreadcrumbs('/flows', '?node=gateway', model)).toEqual([
      { label: 'API Explorer', to: '/flows' },
    ]);
  });
});

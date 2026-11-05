import { describe, expect, it } from 'vitest';
import type { ArchComponent, DocsData, Flow } from '../data/schema.ts';
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

  it('ignores a selection on pages that have nothing to select', () => {
    expect(buildBreadcrumbs('/flows', '?node=gateway', model)).toEqual([
      { label: 'API Explorer', to: '/flows' },
    ]);
  });
});

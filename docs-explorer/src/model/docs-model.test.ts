import { describe, expect, it } from 'vitest';
import type { ArchComponent, DocsData, Flow } from '../data/schema.ts';
import type { IndexedFile, IndexedSymbol, SourceIndex } from '../data/source-index.ts';
import { createDocsModel } from './docs-model.ts';

function symbol(id: string): IndexedSymbol {
  return {
    id,
    name: id.split('#')[1] ?? id,
    kind: 'function',
    exported: true,
    startLine: 1,
    endLine: 2,
    calls: [],
    calledBy: [],
    externalCalls: [],
    routes: [],
  };
}

function file(path: string, app: string, symbolNames: string[]): IndexedFile {
  return {
    path,
    app,
    language: 'ts',
    lineCount: 10,
    symbols: symbolNames.map((name) => symbol(`${path}#${name}`)),
  };
}

function component(id: string, path?: string): ArchComponent {
  return { id, name: id, kind: 'app', status: 'verified', summary: id, responsibilities: [], path };
}

const index: SourceIndex = {
  files: [
    file('backend/shared/src/health.ts', 'shared', ['healthRouter']),
    file('backend/gateway/src/app.ts', 'gateway', ['createApp']),
    file('backend/gateway/src/admin/tools.ts', 'gateway', ['adminTool']),
  ],
};

const flow: Flow = {
  id: 'ready',
  title: 'GET /readyz',
  category: 'api',
  route: { method: 'GET', path: '/readyz' },
  apps: ['gateway'],
  summary: 'Readiness',
  status: 'verified',
  steps: [
    { id: 'call', title: 'Call', kind: 'trigger', status: 'verified', what: '', why: '' },
    {
      id: 'checks',
      title: 'Run the checks',
      kind: 'handler',
      status: 'verified',
      symbol: 'backend/shared/src/health.ts#healthRouter',
      what: '',
      why: '',
      next: [
        { to: 'ok', kind: 'branch', label: 'every check passed' },
        { to: 'fail', kind: 'error', label: 'a check failed' },
      ],
    },
    { id: 'ok', title: '200', kind: 'response', status: 'verified', what: '', why: '' },
    { id: 'fail', title: '503', kind: 'response', status: 'verified', what: '', why: '' },
  ],
};

const docs: DocsData = {
  components: [
    component('shared', 'backend/shared'),
    component('gateway', 'backend/gateway'),
    component('admin', 'backend/gateway/src/admin'),
    component('redis'),
  ],
  links: [
    { from: 'gateway', to: 'shared', kind: 'internal', label: 'imports', status: 'verified' },
    { from: 'gateway', to: 'redis', kind: 'data', label: 'PING', status: 'verified' },
  ],
  flows: [flow],
  notes: [
    { symbol: 'backend/gateway/src/app.ts#createApp', status: 'verified', summary: '', why: '' },
  ],
};

const model = createDocsModel(index, docs);

describe('createDocsModel', () => {
  it('finds a symbol together with its file', () => {
    const found = model.getSymbol('backend/gateway/src/app.ts#createApp');
    expect(found?.symbol.name).toBe('createApp');
    expect(found?.file.path).toBe('backend/gateway/src/app.ts');
    expect(model.getSymbol('backend/gateway/src/app.ts#missing')).toBeUndefined();
  });

  it('finds notes, flows and steps by id', () => {
    expect(model.getNote('backend/gateway/src/app.ts#createApp')).toBeDefined();
    expect(model.getFlow('ready')?.title).toBe('GET /readyz');
    expect(model.getStep('ready', 'checks')?.title).toBe('Run the checks');
    expect(model.getStep('ready', 'nope')).toBeUndefined();
  });

  it('gives a file to the deepest component whose folder holds it', () => {
    expect(model.componentOfFile('backend/gateway/src/app.ts')?.id).toBe('gateway');
    expect(model.componentOfFile('backend/gateway/src/admin/tools.ts')?.id).toBe('admin');
    // A folder name that only starts the same way is a different folder.
    expect(model.componentOfFile('backend/gateway-old/src/app.ts')).toBeUndefined();
    expect(model.filesOf('gateway').map((f) => f.path)).toEqual(['backend/gateway/src/app.ts']);
  });

  it('lists the links of a component from its side', () => {
    expect(
      model.connectionsOf('gateway').map((c) => [c.direction, c.other.id, c.link.kind]),
    ).toEqual([
      ['out', 'shared', 'internal'],
      ['out', 'redis', 'data'],
    ]);
    expect(model.connectionsOf('shared').map((c) => [c.direction, c.other.id])).toEqual([
      ['in', 'gateway'],
    ]);
  });

  it('adds the implied next-step lines and keeps the written ones', () => {
    expect(model.flowLines(flow)).toEqual([
      { from: 'call', to: 'checks', kind: 'next' },
      { from: 'checks', to: 'ok', kind: 'branch', label: 'every check passed' },
      { from: 'checks', to: 'fail', kind: 'error', label: 'a check failed' },
      // ok -> fail is implied by the list order, the same rule the schema states.
      { from: 'ok', to: 'fail', kind: 'next' },
    ]);
  });

  it('finds the steps before and after a step, with the line between them', () => {
    expect(model.stepsBefore(flow, 'checks').map((n) => n.step.id)).toEqual(['call']);
    expect(model.stepsAfter(flow, 'checks').map((n) => [n.step.id, n.line.kind])).toEqual([
      ['ok', 'branch'],
      ['fail', 'error'],
    ]);
    expect(model.stepsBefore(flow, 'call')).toEqual([]);
  });

  it('finds the flow steps that run a symbol', () => {
    const usages = model.usagesOf('backend/shared/src/health.ts#healthRouter');
    expect(usages.map((u) => [u.flow.id, u.step.id])).toEqual([['ready', 'checks']]);
    expect(model.usagesOf('backend/gateway/src/app.ts#createApp')).toEqual([]);
  });

  it('finds the documented flow for a route by method and path', () => {
    expect(model.flowForRoute('GET', '/readyz')?.id).toBe('ready');
    expect(model.flowForRoute('get', '/readyz')?.id).toBe('ready');
    expect(model.flowForRoute('POST', '/readyz')).toBeUndefined();
    expect(model.flowForRoute('GET', '/healthz')).toBeUndefined();
  });

  it('finds the flows a component runs or whose steps are its code', () => {
    expect(model.flowsOf('gateway').map((f) => f.id)).toEqual(['ready']);
    expect(model.flowsOf('shared').map((f) => f.id)).toEqual(['ready']);
    expect(model.flowsOf('redis')).toEqual([]);
  });
});

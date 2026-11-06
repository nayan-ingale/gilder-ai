// Checks the search entries against the real docs and code index: one entry per thing, every
// entry opens a real page, and every route in the code leads to the flow written for it.
import { describe, expect, it } from 'vitest';
import type { DocPage, Flow } from '../data/schema.ts';
import { sectionOf } from '../layout/sections.ts';
import { createGuidesModel } from '../model/guides.ts';
import { docs, guides } from '../model/index.ts';
import { NAV, SELECT, paths } from '../routes.ts';
import {
  buildSearchDocuments,
  docsDocuments,
  routeEntries,
  type SearchType,
} from './search-documents.ts';
import { createSearchEngine } from './search-engine.ts';

const documents = buildSearchDocuments(docs);

const ofType = (type: SearchType) => documents.filter((doc) => doc.type === type);

/** Splits a `to` into its path and the selection in its query. */
function parse(to: string): { pathname: string; query: URLSearchParams } {
  const question = to.indexOf('?');
  return question === -1
    ? { pathname: to, query: new URLSearchParams() }
    : { pathname: to.slice(0, question), query: new URLSearchParams(to.slice(question + 1)) };
}

describe('buildSearchDocuments', () => {
  it('gives every entry a unique id and a title', () => {
    const ids = documents.map((doc) => doc.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const doc of documents) expect(doc.title.trim()).not.toBe('');
  });

  it('has one entry per page, flow, step, component, symbol and file', () => {
    const symbolCount = docs.files.reduce((sum, file) => sum + file.symbols.length, 0);
    const stepCount = docs.flows.reduce((sum, flow) => sum + flow.steps.length, 0);
    expect(ofType('page')).toHaveLength(NAV.length);
    const sectionCount = guides.pages.reduce((sum, page) => sum + page.sections.length, 0);
    expect(ofType('doc')).toHaveLength(guides.docsPages.length + sectionCount);
    expect(ofType('flow')).toHaveLength(docs.flows.length);
    expect(ofType('step')).toHaveLength(stepCount);
    expect(ofType('component')).toHaveLength(docs.components.length);
    expect(ofType('symbol')).toHaveLength(symbolCount);
    expect(ofType('file')).toHaveLength(docs.files.length);
    const undocumented = routeEntries(docs).filter((route) => route.flowId === undefined);
    expect(ofType('route')).toHaveLength(undocumented.length);
  });

  it('opens a known page for every entry, with only known selection keys', () => {
    const selectKeys = new Set<string>(Object.values(SELECT));
    for (const doc of documents) {
      const { pathname, query } = parse(doc.to);
      expect(sectionOf(pathname), doc.id).toBeDefined();
      for (const key of query.keys()) expect(selectKeys.has(key), `${doc.id}: ${key}`).toBe(true);
    }
  });

  it('opens what each entry names', () => {
    for (const doc of ofType('component')) {
      const { query } = parse(doc.to);
      expect(docs.getComponent(query.get(SELECT.node) ?? '')).toBeDefined();
    }
    for (const doc of ofType('step')) {
      const { pathname, query } = parse(doc.to);
      const flowId = decodeURIComponent(pathname.replace('/flows/', ''));
      expect(docs.getStep(flowId, query.get(SELECT.step) ?? ''), doc.id).toBeDefined();
    }
    for (const doc of ofType('symbol')) {
      const { query } = parse(doc.to);
      const located = docs.getSymbol(query.get(SELECT.symbol) ?? '');
      expect(located, doc.id).toBeDefined();
      expect(query.get(SELECT.file)).toBe(located?.file.path);
    }
    for (const doc of ofType('file')) {
      const { query } = parse(doc.to);
      expect(docs.getFile(query.get(SELECT.file) ?? ''), doc.id).toBeDefined();
    }
    for (const doc of ofType('doc')) {
      const { pathname, query } = parse(doc.to);
      const page =
        pathname === paths.errors()
          ? guides.pageForSection('errors')
          : guides.getPage(decodeURIComponent(pathname.replace('/docs/', '')));
      expect(page, doc.id).toBeDefined();
      const section = query.get(SELECT.section);
      if (section !== null) {
        expect(
          page?.sections.some((s) => s.id === section),
          doc.id,
        ).toBe(true);
      }
    }
  });

  it('names a step by its flow and a symbol by its file', () => {
    const step = documents.find((doc) => doc.id === 'step:readiness-check/ping-redis');
    expect(step).toMatchObject({
      title: 'Ping Redis',
      to: paths.flow('readiness-check', 'ping-redis'),
    });
    expect(step).toMatchObject({ subtitle: 'GET /readyz', label: 'Data store' });

    const router = documents.find(
      (doc) => doc.id === 'symbol:backend/shared/src/health.ts#healthRouter',
    );
    expect(router).toMatchObject({
      title: 'healthRouter',
      subtitle: 'backend/shared/src/health.ts',
      label: 'Function',
    });
  });
});

describe('routeEntries', () => {
  it('finds the routes registered in the code', () => {
    const routes = routeEntries(docs).map((route) => `${route.method} ${route.path}`);
    expect(routes).toEqual(expect.arrayContaining(['GET /healthz', 'GET /readyz']));
  });

  it('matches each route to the flow documented for it', () => {
    const flowFor = (key: string) =>
      routeEntries(docs).find((route) => `${route.method} ${route.path}` === key)?.flowId;
    expect(flowFor('GET /healthz')).toBe('health-check');
    expect(flowFor('GET /readyz')).toBe('readiness-check');
    for (const route of routeEntries(docs)) {
      if (!route.flowId) continue;
      expect(docs.getFlow(route.flowId)?.route).toEqual({ method: route.method, path: route.path });
    }
  });

  it('finds a documented route through its flow, and lists it once', () => {
    for (const route of routeEntries(docs)) {
      const key = `${route.method} ${route.path}`;
      const entries = documents.filter((doc) => doc.title === key);
      expect(entries, key).toHaveLength(1);
      expect(entries[0]?.to).toBe(
        route.flowId
          ? paths.flow(route.flowId)
          : paths.code({ symbol: route.symbolId, file: route.filePath }),
      );
    }
  });

  it('opens the registering code for a route with no flow', () => {
    const model = {
      ...docs,
      flows: docs.flows.filter((flow: Flow) => flow.id !== 'health-check'),
      flowForRoute: (method: string, path: string) =>
        path === '/healthz' ? undefined : docs.flowForRoute(method, path),
    };
    const route = buildSearchDocuments(model).find((doc) => doc.type === 'route');
    expect(route).toMatchObject({
      title: 'GET /healthz',
      subtitle: 'healthRouter · backend/shared/src/health.ts',
      to: paths.code({
        symbol: 'backend/shared/src/health.ts#healthRouter',
        file: 'backend/shared/src/health.ts',
      }),
    });
  });
});

describe('docsDocuments', () => {
  const stack: DocPage = {
    id: 'stack',
    title: 'Tech stack',
    summary: 'What the project is built with.',
    sections: [
      {
        id: 'packages',
        title: 'Packages',
        status: 'verified',
        blocks: [{ kind: 'text', text: 'Every package, by `layer`.' }, { kind: 'packages' }],
      },
    ],
  };
  const errors: DocPage = {
    id: 'error-handling',
    title: 'Error handling',
    summary: 'How errors become responses.',
    section: 'errors',
    sections: [
      {
        id: 'shape',
        title: 'The response shape',
        status: 'verified',
        blocks: [{ kind: 'list', items: ['A `problem+json` body'] }],
      },
    ],
  };
  const model = createGuidesModel(
    {
      pages: [stack, errors],
      packageNotes: [{ name: 'pino', layer: 'backend', why: 'Writes JSON logs.' }],
      plannedTools: [
        {
          name: 'Stripe',
          package: 'stripe',
          layer: 'payments',
          why: 'Takes payments.',
          plannedIn: 'Billing',
        },
      ],
    },
    { packages: [{ name: 'pino', usedBy: [{ app: 'shared', version: '^10.4.0', dev: false }] }] },
  );
  const entries = docsDocuments(model);

  it('has one entry per page under Docs and one per section of every page', () => {
    expect(entries.map((entry) => [entry.id, entry.to])).toEqual([
      ['doc:stack', paths.doc('stack')],
      ['doc:stack/packages', paths.doc('stack', 'packages')],
      ['doc:error-handling/shape', paths.errors('shape')],
    ]);
  });

  it('names a section by its page and searches its words', () => {
    const shape = entries.find((entry) => entry.id === 'doc:error-handling/shape');
    expect(shape).toMatchObject({ title: 'The response shape', subtitle: 'Error handling' });
    expect(shape?.text).toBe('A problem+json body');
  });

  it('finds the packages section by a package, why it is used, or a planned tool', () => {
    const engine = createSearchEngine(entries);
    const found = (query: string) =>
      engine.search(query).groups.flatMap((group) => group.hits.map((hit) => hit.doc.id));
    expect(found('pino')).toContain('doc:stack/packages');
    expect(found('JSON logs')).toContain('doc:stack/packages');
    expect(found('stripe')).toContain('doc:stack/packages');
    expect(found('response shape')).toEqual(['doc:error-handling/shape']);
  });
});

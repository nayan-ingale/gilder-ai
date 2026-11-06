// Checks the search entries against the real docs and code index: one entry per thing, every
// entry opens a real page, and every route in the code leads to the flow written for it.
import { describe, expect, it } from 'vitest';
import type { Flow } from '../data/schema.ts';
import { sectionOf } from '../layout/sections.ts';
import { docs } from '../model/index.ts';
import { NAV, SELECT, paths } from '../routes.ts';
import { buildSearchDocuments, routeEntries, type SearchType } from './search-documents.ts';

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

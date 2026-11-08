// Runs real queries against the real docs, so a change in ranking that buries the obvious
// answer shows up here.
import { describe, expect, it } from 'vitest';
import { docs } from '../model/index.ts';
import { NAV, paths } from '../routes.ts';
import { buildSearchDocuments } from './search-documents.ts';
import {
  GROUP_LIMIT,
  GROUP_ORDER,
  createSearchEngine,
  highlightTitle,
  indexTerms,
  pathQuery,
  type SearchResults,
} from './search-engine.ts';

const engine = createSearchEngine(buildSearchDocuments(docs));

const hits = (results: SearchResults) => results.groups.flatMap((group) => group.hits);
const titles = (results: SearchResults) => hits(results).map((hit) => hit.doc.title);
const first = (query: string) => hits(engine.search(query))[0]?.doc;

describe('search', () => {
  it('lists the pages to jump to before anything is typed', () => {
    const results = engine.search('  ');
    expect(results.groups.map((group) => group.id)).toEqual(['jump']);
    expect(titles(results)).toEqual(NAV.map((item) => item.label));
  });

  it('puts GET /readyz first for "readyz"', () => {
    expect(first('readyz')).toMatchObject({
      title: 'GET /readyz',
      to: paths.flow('readiness-check'),
    });
  });

  it('finds a route by method and path', () => {
    expect(first('GET /healthz')).toMatchObject({ to: paths.flow('health-check') });
  });

  it('forgives a typo in a longer word', () => {
    expect(first('healthRoutr')).toMatchObject({ title: 'healthRouter', type: 'symbol' });
  });

  it('does not guess at typos in short words', () => {
    expect(hits(engine.search('jbo'))).toHaveLength(0);
  });

  it('matches the start of a word', () => {
    expect(titles(engine.search('heal'))).toContain('healthRouter');
  });

  it('matches part of a camelCase name', () => {
    // `router` is part of too many names now (turnRouter, chatRouter...) to pick one out.
    expect(titles(engine.search('timeout'))).toContain('withTimeout');
  });

  it('finds the Redis component and the code that talks to Redis', () => {
    const results = engine.search('redis');
    expect(first('redis')).toMatchObject({ type: 'component', title: 'Redis' });
    const found = titles(results);
    expect(found).toEqual(expect.arrayContaining(['createRedis', 'pingRedis']));
  });

  it('finds the Gateway component first for "gateway"', () => {
    expect(first('gateway')).toMatchObject({ type: 'component', title: 'Gateway' });
  });

  it('puts the file first for a query typed as a path', () => {
    const healthFile = { type: 'file', path: 'backend/shared/src/health.ts' };
    expect(first('src/health.ts')).toMatchObject(healthFile);
    expect(first('shared/src/health.ts')).toMatchObject(healthFile);
    expect(first('health.ts')).toMatchObject(healthFile);
    // Still being typed: the path holds the query.
    expect(first('src/heal')).toMatchObject(healthFile);
    expect(first('gateway/src/app.ts')).toMatchObject({
      type: 'file',
      path: 'backend/gateway/src/app.ts',
    });
  });

  it('needs every word to match', () => {
    const found = hits(engine.search('ping redis'));
    expect(found.length).toBeGreaterThan(0);
    for (const hit of found) {
      const words = `${hit.doc.title} ${hit.doc.subtitle} ${hit.doc.text}`.toLowerCase();
      expect(words, hit.doc.id).toMatch(/ping/);
    }
  });

  it('keeps groups in a fixed order with a limit each, the best match first', () => {
    for (const query of ['health', 'error', 'redis', 'app', 'gateway', 'readyz']) {
      const results = engine.search(query);
      // "Best match", when there is one, leads; the rest follow the fixed order.
      expect(
        results.groups.findIndex((group) => group.id === 'best'),
        query,
      ).toBeLessThan(1);
      const order = results.groups
        .filter((group) => group.id !== 'best')
        .map((group) => GROUP_ORDER.indexOf(group.id));
      expect(order, query).toEqual([...order].sort((a, b) => a - b));
      expect(order, query).not.toContain(-1);
      for (const group of results.groups) {
        expect(group.hits.length, `${query}: ${group.id}`).toBeLessThanOrEqual(GROUP_LIMIT);
      }
      const ids = hits(results).map((hit) => hit.doc.id);
      expect(new Set(ids).size, query).toBe(ids.length);
    }
  });

  it('counts every match, not only the ones shown', () => {
    const results = engine.search('app');
    expect(results.total).toBeGreaterThan(hits(results).length);
  });

  it('finds nothing for words that are not in the docs', () => {
    expect(engine.search('zzzqqq').groups).toEqual([]);
    expect(engine.search('/').groups).toEqual([]);
  });
});

describe('pathQuery', () => {
  it('reads one word with a slash or a dot as a path', () => {
    expect(pathQuery('src/health.ts')).toBe('src/health.ts');
    expect(pathQuery(' ./src/Health.ts ')).toBe('src/health.ts');
    expect(pathQuery('health.ts')).toBe('health.ts');
  });

  it('leaves words and routes alone', () => {
    expect(pathQuery('health')).toBeUndefined();
    expect(pathQuery('GET /readyz')).toBeUndefined();
    expect(pathQuery('/')).toBeUndefined();
  });
});

describe('indexTerms', () => {
  it('keeps a camelCase word whole and adds its parts', () => {
    expect(indexTerms('healthRouter AppError')).toEqual([
      'healthRouter',
      'health',
      'Router',
      'AppError',
      'App',
      'Error',
    ]);
  });

  it('splits paths and routes on punctuation', () => {
    expect(indexTerms('GET /readyz backend/shared/src/health.ts')).toEqual([
      'GET',
      'readyz',
      'backend',
      'shared',
      'src',
      'health',
      'ts',
    ]);
  });
});

describe('highlightTitle', () => {
  const marked = (title: string, query: string[], matched?: string[]) =>
    highlightTitle(title, query, matched)
      .filter((part) => part.match)
      .map((part) => part.text);

  it('marks the start of a word that begins with a query word', () => {
    expect(marked('GET /readyz', ['ready'])).toEqual(['ready']);
  });

  it('marks a camelCase part', () => {
    expect(marked('healthRouter', ['router'])).toEqual(['Router']);
  });

  it('marks a whole word that matched with a typo', () => {
    expect(marked('healthRouter', ['healthroutr'], ['healthrouter'])).toEqual(['healthRouter']);
  });

  it('keeps every character, in order', () => {
    const parts = highlightTitle('Ping Redis', ['redis']);
    expect(parts.map((part) => part.text).join('')).toBe('Ping Redis');
    expect(parts).toEqual([
      { offset: 0, text: 'Ping ', match: false },
      { offset: 5, text: 'Redis', match: true },
    ]);
  });
});

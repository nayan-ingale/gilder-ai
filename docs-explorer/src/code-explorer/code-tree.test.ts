import { describe, expect, it } from 'vitest';
import { docs } from '../model/index.ts';
import { APP_ORDER, buildCodeTree, fileLabel, filterTree, type CodeTree } from './code-tree.ts';

// Runs against the real code index, so a change in the code that breaks a rule shows up here.
const tree = buildCodeTree();

/** The shown files and, for each, the names of its shown symbols. */
function shown(result: CodeTree): Record<string, string[]> {
  return Object.fromEntries(
    result.apps.flatMap((app) =>
      app.files.map((file) => [file.path, file.symbols.map((symbol) => symbol.name)]),
    ),
  );
}

describe('buildCodeTree', () => {
  it('holds every indexed file and symbol once', () => {
    expect(tree.fileCount).toBe(docs.files.length);
    expect(tree.symbolCount).toBe(docs.files.reduce((sum, file) => sum + file.symbols.length, 0));
    const paths = tree.apps.flatMap((app) => app.files.map((file) => file.path));
    expect(new Set(paths).size).toBe(docs.files.length);
  });

  it('groups files by app in a fixed order', () => {
    const apps = tree.apps.map((group) => group.app);
    expect(apps).toEqual(APP_ORDER.filter((app) => apps.includes(app)));
    expect(apps[0]).toBe('frontend');
    expect(apps.at(-1)).toBe('shared');
    for (const group of tree.apps) {
      expect(group.files.every((file) => docs.getFile(file.path)?.app === group.app)).toBe(true);
    }
  });

  it('names each group after the part of the system that holds its folder', () => {
    const gateway = tree.apps.find((group) => group.app === 'gateway');
    expect(gateway?.title).toBe('Gateway');
    expect(gateway?.folder).toBe('backend/gateway');
  });

  it('shows each file by its path inside its app', () => {
    const shared = tree.apps.find((group) => group.app === 'shared');
    const health = shared?.files.find((file) => file.path === 'backend/shared/src/health.ts');
    expect(health?.label).toBe('src/health.ts');
    expect(fileLabel('frontend/src/app/page.tsx')).toBe('src/app/page.tsx');
    expect(fileLabel('somewhere/else.ts')).toBe('somewhere/else.ts');
  });

  it('lists symbols in line order with their kind and routes', () => {
    const health = tree.apps
      .flatMap((group) => group.files)
      .find((file) => file.path === 'backend/shared/src/health.ts');
    const lines = health?.symbols.map((symbol) => symbol.line) ?? [];
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
    const router = health?.symbols.find((symbol) => symbol.name === 'healthRouter');
    expect(router?.kind).toBe('function');
    expect(router?.routes).toEqual(['GET /healthz', 'GET /readyz']);
  });

  it('names top-level code after its file', () => {
    const symbol = tree.apps
      .flatMap((group) => group.files)
      .find((file) => file.path === 'backend/gateway/src/index.ts')
      ?.symbols.find((item) => item.kind === 'module');
    expect(symbol?.name).toBe('index.ts (top level)');
  });
});

describe('filterTree', () => {
  it('keeps everything for an empty query', () => {
    expect(filterTree(tree, '')).toBe(tree);
    expect(filterTree(tree, '   ')).toBe(tree);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterTree(tree, 'no-such-thing-anywhere')).toEqual({
      apps: [],
      fileCount: 0,
      symbolCount: 0,
    });
  });

  it('finds a route by its path or by method and path', () => {
    const expected = { 'backend/shared/src/health.ts': ['healthRouter'] };
    expect(shown(filterTree(tree, 'readyz'))).toEqual(expected);
    expect(shown(filterTree(tree, 'GET /readyz'))).toEqual(expected);
    expect(filterTree(tree, 'readyz')).toMatchObject({ fileCount: 1, symbolCount: 1 });
  });

  it('keeps every symbol of a file whose path matches, and only matching ones otherwise', () => {
    const result = shown(filterTree(tree, 'redis'));
    // redis.ts matches by its path, so it keeps all its symbols.
    expect(result['backend/shared/src/redis.ts']).toEqual(['createRedis', 'pingRedis']);
    // An app's startup file matches only through its `redis` constant.
    expect(result['backend/gateway/src/index.ts']).toEqual(['redis']);
    expect(result['backend/services/billing/src/index.ts']).toBeUndefined();
  });

  it('ignores case', () => {
    expect(shown(filterTree(tree, 'HEALTHROUTER'))).toEqual({
      'backend/shared/src/health.ts': ['healthRouter'],
    });
  });

  it('matches kind labels and signatures', () => {
    const topLevel = filterTree(tree, 'top-level code');
    expect(topLevel.symbolCount).toBeGreaterThan(0);
    expect(
      topLevel.apps.flatMap((app) => app.files.flatMap((file) => file.symbols)).map((s) => s.kind),
    ).toEqual(Array(topLevel.symbolCount).fill('module'));

    expect(shown(filterTree(tree, 'Promise<T>, ms: number'))).toEqual({
      'backend/shared/src/health.ts': ['withTimeout'],
    });
  });

  it('needs every word to match, in the file path or the symbol', () => {
    expect(shown(filterTree(tree, 'gateway redis'))).toEqual({
      'backend/gateway/src/index.ts': ['redis'],
    });
  });

  it('keeps app groups in order and drops empty ones', () => {
    const result = filterTree(tree, 'createApp');
    const apps = result.apps.map((group) => group.app);
    expect(apps).toEqual(APP_ORDER.filter((app) => apps.includes(app)));
    expect(apps).not.toContain('shared');
    expect(result.apps.every((group) => group.files.length > 0)).toBe(true);
  });
});

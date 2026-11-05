import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { IndexedSymbol, SourceIndex } from '../../src/data/source-index.ts';
import { collectSourceFiles, isBlockedPath } from './files.ts';
import { buildSourceIndex } from './symbols.ts';

const NODE_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2023',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    skipLibCheck: true,
    types: [],
  },
  include: ['src'],
});

// A small fake repo: two backend packages, an npm package and a React page.
const FIXTURE: Record<string, string> = {
  'backend/shared/package.json': '{ "type": "module" }',
  'backend/shared/tsconfig.json': NODE_TSCONFIG,
  'backend/shared/src/math.ts': `/** Adds two numbers. */
export function add(a: number, b = 1): number {
  return a + b;
}

export const double = (n: number) => add(n, n);

export class Calculator {
  total(): number {
    return add(1, 2);
  }
}

export interface Options {
  precision: number;
}
`,
  'backend/gateway/package.json': '{ "type": "module" }',
  'backend/gateway/tsconfig.json': NODE_TSCONFIG,
  'backend/gateway/node_modules/fake-lib/package.json':
    '{ "name": "fake-lib", "type": "module", "exports": { ".": { "types": "./index.d.ts" } } }',
  'backend/gateway/node_modules/fake-lib/index.d.ts':
    'export declare function greet(name: string): string;',
  'backend/gateway/src/index.ts': `import { greet } from 'fake-lib';
import { add, Calculator } from '../../shared/src/math.ts';

const router = { get: (_path: string, handler: () => number) => handler };

router.get('/healthz', () => add(2, 3));
new Calculator().total();
greet('docs');
`,
  'frontend/tsconfig.json': JSON.stringify({
    compilerOptions: { jsx: 'preserve', module: 'ESNext', moduleResolution: 'bundler', types: [] },
  }),
  'frontend/src/page.tsx': `function Badge() {
  return <span>new</span>;
}

export function Page() {
  return <Badge />;
}
`,
};

let root: string;
let index: SourceIndex;

beforeAll(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), 'indexer-symbols-')));
  for (const [filePath, content] of Object.entries(FIXTURE)) {
    mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
    writeFileSync(path.join(root, filePath), content);
  }
  index = buildSourceIndex(root, collectSourceFiles(root));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function symbol(id: string): IndexedSymbol {
  const found = index.files.flatMap((file) => file.symbols).find((item) => item.id === id);
  if (!found) {
    throw new Error(`no symbol ${id}`);
  }
  return found;
}

describe('buildSourceIndex', () => {
  it('records signatures, parameters, comments and line numbers', () => {
    const add = symbol('backend/shared/src/math.ts#add');

    expect(add).toMatchObject({
      kind: 'function',
      exported: true,
      doc: 'Adds two numbers.',
      startLine: 2,
      endLine: 4,
      returnType: 'number',
      signature: 'add(a: number, b: number = 1): number',
    });
    expect(add.params).toEqual([
      { name: 'a', type: 'number', optional: false },
      { name: 'b', type: 'number', optional: true, defaultValue: '1' },
    ]);
  });

  it('infers a return type that is not written in the code', () => {
    expect(symbol('backend/shared/src/math.ts#double').signature).toBe('double(n: number): number');
  });

  it('lists classes, their methods and types', () => {
    expect(symbol('backend/shared/src/math.ts#Calculator').kind).toBe('class');
    expect(symbol('backend/shared/src/math.ts#Calculator.total').signature).toBe(
      'Calculator.total(): number',
    );
    expect(symbol('backend/shared/src/math.ts#Options').kind).toBe('interface');
  });

  it('links calls across packages in both directions', () => {
    const startup = symbol('backend/gateway/src/index.ts#(module)');

    expect(startup.calls).toEqual([
      'backend/shared/src/math.ts#Calculator',
      'backend/shared/src/math.ts#Calculator.total',
      'backend/shared/src/math.ts#add',
    ]);
    expect(symbol('backend/shared/src/math.ts#add').calledBy).toEqual([
      'backend/gateway/src/index.ts#(module)',
      'backend/shared/src/math.ts#Calculator.total',
      'backend/shared/src/math.ts#double',
    ]);
  });

  it('finds routes and calls into npm packages', () => {
    const startup = symbol('backend/gateway/src/index.ts#(module)');

    expect(startup).toMatchObject({ startLine: 6, endLine: 8 });
    expect(startup.routes).toEqual([{ method: 'GET', path: '/healthz', line: 6 }]);
    expect(startup.externalCalls).toEqual([{ package: 'fake-lib', name: 'greet' }]);
  });

  it('counts a rendered React component as a call', () => {
    expect(symbol('frontend/src/page.tsx#Page').calls).toEqual(['frontend/src/page.tsx#Badge']);
  });

  it("names each file's app", () => {
    expect(index.files.map((file) => `${file.app}: ${file.path}`)).toEqual([
      'gateway: backend/gateway/src/index.ts',
      'shared: backend/shared/src/math.ts',
      'frontend: frontend/src/page.tsx',
    ]);
  });
});

describe('the real repository', () => {
  it('indexes the shared toolkit, its routes and its callers', () => {
    const repoRoot = path.resolve(import.meta.dirname, '../../..');
    const files = collectSourceFiles(repoRoot);
    const realIndex = buildSourceIndex(repoRoot, files);
    const healthRouter = realIndex.files
      .flatMap((file) => file.symbols)
      .find((item) => item.id === 'backend/shared/src/health.ts#healthRouter');

    expect(files.some((file) => isBlockedPath(file.path))).toBe(false);
    expect(healthRouter?.routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'GET /healthz',
      'GET /readyz',
    ]);
    expect(healthRouter?.calledBy).toContain('backend/shared/src/service.ts#createService');
    // router.get and res.json are declared in Express's types-only package; they count as express.
    expect(healthRouter?.externalCalls).toContainEqual({ package: 'express', name: 'json' });
    expect(healthRouter?.externalCalls.map((call) => call.package)).not.toContain(
      'express-serve-static-core',
    );
  }, 60_000);
});

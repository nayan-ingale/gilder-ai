import { describe, expect, it } from 'vitest';
import type { Flow } from '../../src/data/schema.ts';
import type { IndexedSymbol, SourceIndex } from '../../src/data/source-index.ts';
import { checkDocs, type DocsData, type RepoAccess } from './check-docs.ts';

const CODE = `export function healthRouter() {
  router.get('/healthz', handler);
}
`;

function symbol(
  overrides: Partial<IndexedSymbol> & Pick<IndexedSymbol, 'id' | 'name'>,
): IndexedSymbol {
  return {
    kind: 'function',
    exported: true,
    startLine: 1,
    endLine: 3,
    calls: [],
    calledBy: [],
    externalCalls: [],
    routes: [],
    ...overrides,
  };
}

// A tiny repo: one shared file with one function that registers GET /healthz.
const INDEX: SourceIndex = {
  files: [
    {
      path: 'backend/shared/src/health.ts',
      app: 'shared',
      language: 'ts',
      lineCount: 3,
      symbols: [
        symbol({
          id: 'backend/shared/src/health.ts#healthRouter',
          name: 'healthRouter',
          routes: [{ method: 'GET', path: '/healthz', line: 2 }],
        }),
      ],
    },
  ],
};

const REPO: RepoAccess = {
  readFile: (filePath) => (filePath === 'backend/shared/src/health.ts' ? CODE : undefined),
  exists: (filePath) =>
    [
      'backend/shared',
      'backend/shared/src/health.ts',
      'backend/shared/src/health.test.ts',
    ].includes(filePath),
};

const FLOW: Flow = {
  id: 'health-check',
  title: 'GET /healthz',
  category: 'api',
  route: { method: 'GET', path: '/healthz' },
  apps: ['shared'],
  summary: 'Says the app is alive.',
  status: 'verified',
  steps: [
    {
      id: 'caller',
      title: 'Caller',
      kind: 'trigger',
      status: 'inferred',
      what: 'Calls.',
      why: 'To check.',
    },
    {
      id: 'route',
      title: 'Route',
      kind: 'handler',
      status: 'verified',
      symbol: 'backend/shared/src/health.ts#healthRouter',
      highlight: "router.get('/healthz', handler);",
      what: 'Answers.',
      why: 'To answer.',
    },
  ],
};

/** Valid docs; each test breaks one thing. */
function validDocs(): DocsData {
  return {
    components: [
      {
        id: 'shared',
        name: 'Shared',
        kind: 'library',
        status: 'verified',
        summary: 'Shared code.',
        responsibilities: [],
        path: 'backend/shared',
        entryPoints: ['backend/shared/src/health.ts#healthRouter'],
      },
      {
        id: 's3',
        name: 'S3',
        kind: 'external',
        status: 'planned',
        plannedIn: 'PDF and image Q&A',
        summary: 'Files.',
        responsibilities: [],
      },
    ],
    links: [
      {
        from: 'shared',
        to: 's3',
        kind: 'external',
        label: 'files',
        status: 'planned',
        plannedIn: 'PDF and image Q&A',
      },
    ],
    flows: [structuredClone(FLOW)],
    notes: [
      {
        symbol: 'backend/shared/src/health.ts#healthRouter',
        status: 'verified',
        summary: 'Health routes.',
        why: 'So the app can be checked.',
        tests: ['backend/shared/src/health.test.ts'],
      },
    ],
  };
}

function problemsOf(docs: DocsData): string[] {
  return checkDocs(INDEX, docs, REPO).problems;
}

describe('checkDocs', () => {
  it('accepts docs that match the code', () => {
    expect(checkDocs(INDEX, validDocs(), REPO)).toEqual({ problems: [], warnings: [] });
  });

  it('rejects a reference to a symbol that does not exist', () => {
    const docs = validDocs();
    docs.notes[0]!.symbol = 'backend/shared/src/health.ts#gone';

    expect(problemsOf(docs)).toEqual([
      'note: no symbol backend/shared/src/health.ts#gone in the code',
    ]);
  });

  it('rejects a highlight that is no longer in the code', () => {
    const docs = validDocs();
    docs.flows[0]!.steps[1]!.highlight = "router.get('/health', handler);";

    expect(problemsOf(docs)).toEqual([
      `flow health-check, step route: "router.get('/health', handler);" is no longer in backend/shared/src/health.ts#healthRouter`,
    ]);
  });

  it('rejects a route the code does not register', () => {
    const docs = validDocs();
    docs.flows[0]!.route = { method: 'POST', path: '/healthz' };

    expect(problemsOf(docs)).toEqual(["flow health-check: route POST /healthz isn't in the code"]);
  });

  it('rejects a verified flow with an unverified code step, and edges to missing steps', () => {
    const docs = validDocs();
    const step = docs.flows[0]!.steps[1]!;
    step.status = 'inferred';
    step.next = [{ to: 'nowhere', kind: 'error' }];

    expect(problemsOf(docs)).toEqual([
      'flow health-check, step route: the flow is verified, but this step is inferred',
      "flow health-check, step route: leads to step nowhere, which doesn't exist",
    ]);
  });

  it('checks architecture links, planned sections and folders', () => {
    const docs = validDocs();
    docs.components[0]!.path = 'backend/missing';
    docs.components[1]!.plannedIn = undefined;
    docs.links.push({ from: 'shared', to: 'ghost', kind: 'data', label: 'x', status: 'verified' });

    expect(problemsOf(docs)).toEqual([
      "component shared: folder backend/missing doesn't exist",
      "component s3: planned, but plannedIn doesn't name the feature that adds it",
      'link shared → ghost: no component ghost',
    ]);
  });

  it('rejects duplicate notes and missing test files', () => {
    const docs = validDocs();
    docs.notes.push({ ...docs.notes[0]!, tests: ['backend/shared/src/nope.test.ts'] });

    expect(problemsOf(docs)).toEqual([
      'note backend/shared/src/health.ts#healthRouter: written twice',
      "note backend/shared/src/health.ts#healthRouter: test file backend/shared/src/nope.test.ts doesn't exist",
    ]);
  });

  it('warns about shared code that has no note yet, without failing', () => {
    const docs = validDocs();
    docs.notes = [];

    expect(checkDocs(INDEX, docs, REPO)).toEqual({
      problems: [],
      warnings: ['backend/shared/src/health.ts#healthRouter has no note yet'],
    });
  });
});

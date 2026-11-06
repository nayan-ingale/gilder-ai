import { describe, expect, it } from 'vitest';
import type { ArchComponent, DocBlock, DocPage, Flow } from '../data/schema.ts';
import type { IndexedSymbol, SourceIndex } from '../data/source-index.ts';
import { createDocsModel } from '../model/docs-model.ts';
import { paths } from '../routes.ts';
import {
  blockWords,
  frameLabels,
  groupByPage,
  groupRefs,
  pagePath,
  plainText,
  redirectPath,
  resolveRef,
  sectionElementId,
  symbolFileHint,
} from './guide-links.ts';

function symbol(id: string, kind: IndexedSymbol['kind'] = 'function'): IndexedSymbol {
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

const LOGGER = 'backend/shared/src/logger.ts';
const index: SourceIndex = {
  files: [
    {
      path: LOGGER,
      app: 'shared',
      language: 'ts',
      lineCount: 10,
      symbols: [symbol(`${LOGGER}#createLogger`), symbol(`${LOGGER}#(module)`, 'module')],
    },
  ],
};

const shared: ArchComponent = {
  id: 'shared',
  name: 'Shared library',
  kind: 'library',
  status: 'verified',
  summary: '',
  responsibilities: [],
  path: 'backend/shared',
};

const health: Flow = {
  id: 'health-check',
  title: 'GET /healthz',
  category: 'api',
  apps: [],
  summary: '',
  status: 'verified',
  steps: [],
};

const model = createDocsModel(index, {
  components: [shared],
  links: [],
  flows: [health],
  notes: [],
});

const logging: DocPage = {
  id: 'logging',
  title: 'Logging',
  summary: '',
  sections: [
    { id: 'setup', title: 'Setup', status: 'verified', blocks: [] },
    { id: 'levels', title: 'Levels', status: 'verified', blocks: [] },
  ],
};

const errors: DocPage = {
  id: 'error-handling',
  title: 'Error handling',
  summary: '',
  section: 'errors',
  sections: [{ id: 'shape', title: 'Shape', status: 'verified', blocks: [] }],
};

describe('pagePath', () => {
  it('opens a docs page at its own address', () => {
    expect(pagePath(logging)).toBe(paths.doc('logging'));
    expect(pagePath(logging, 'levels')).toBe('/docs/logging?section=levels');
  });

  it('opens the error-handling page in Error Handling', () => {
    expect(pagePath(errors)).toBe('/errors');
    expect(pagePath(errors, 'shape')).toBe('/errors?section=shape');
  });
});

describe('redirectPath', () => {
  const query = (search: string) => new URLSearchParams(search);

  it('sends the error-handling page to Error Handling, at the same section', () => {
    expect(redirectPath(errors, query('section=shape'))).toBe('/errors?section=shape');
    expect(redirectPath(errors, query(''))).toBe(paths.errors());
  });

  it('keeps any other page at its own address', () => {
    expect(redirectPath(logging, query('section=levels'))).toBeUndefined();
  });
});

describe('sectionElementId', () => {
  it('keeps section ids apart from the other ids on the page', () => {
    expect(sectionElementId('setup')).toBe('doc-section-setup');
  });
});

describe('resolveRef', () => {
  it('finds components and flows', () => {
    expect(resolveRef({ component: 'shared' }, model)).toEqual({
      kind: 'component',
      component: shared,
    });
    expect(resolveRef({ flow: 'health-check' }, model)).toEqual({
      kind: 'flow',
      flow: health,
      to: paths.flow('health-check'),
    });
  });

  it('opens a symbol in the code explorer, in its file', () => {
    expect(resolveRef({ symbol: `${LOGGER}#createLogger` }, model)).toEqual({
      kind: 'symbol',
      name: 'createLogger',
      filePath: LOGGER,
      to: paths.code({ symbol: `${LOGGER}#createLogger`, file: LOGGER }),
    });
    expect(resolveRef({ symbol: `${LOGGER}#(module)` }, model)).toMatchObject({
      name: 'logger.ts (top level)',
    });
  });

  it('links a file only when the code index has it', () => {
    expect(resolveRef({ file: LOGGER }, model)).toEqual({
      kind: 'file',
      path: LOGGER,
      to: paths.code({ file: LOGGER }),
    });
    expect(resolveRef({ file: 'backend/docker-compose.yml' }, model)).toEqual({
      kind: 'file',
      path: 'backend/docker-compose.yml',
    });
  });

  it('shows ids the docs do not know as they are', () => {
    expect(resolveRef({ component: 'ghost' }, model)).toEqual({ kind: 'unknown', text: 'ghost' });
    expect(resolveRef({ flow: 'ghost' }, model)).toEqual({ kind: 'unknown', text: 'ghost' });
    expect(resolveRef({ symbol: 'x.ts#ghost' }, model)).toEqual({
      kind: 'unknown',
      text: 'x.ts#ghost',
    });
  });
});

describe('groupRefs', () => {
  it('groups refs by kind, from the big picture down, each listed once', () => {
    const groups = groupRefs([
      { file: LOGGER },
      { symbol: `${LOGGER}#createLogger` },
      { component: 'shared' },
      { flow: 'health-check' },
      { component: 'gateway' },
      { component: 'shared' },
    ]);
    expect(groups).toEqual([
      { kind: 'component', refs: [{ component: 'shared' }, { component: 'gateway' }] },
      { kind: 'flow', refs: [{ flow: 'health-check' }] },
      { kind: 'symbol', refs: [{ symbol: `${LOGGER}#createLogger` }] },
      { kind: 'file', refs: [{ file: LOGGER }] },
    ]);
    expect(groupRefs([])).toEqual([]);
  });
});

describe('symbolFileHint', () => {
  it('names the file, unless the name already does', () => {
    expect(symbolFileHint('createLogger', LOGGER)).toBe('logger.ts');
    expect(symbolFileHint('logger.ts (top level)', LOGGER)).toBeUndefined();
  });
});

describe('groupByPage', () => {
  it('groups sections under their page, pages in the order they first come', () => {
    const [setup, levels] = logging.sections;
    const [shape] = errors.sections;
    if (!setup || !levels || !shape) throw new Error('fixture sections missing');
    const groups = groupByPage([
      { page: logging, section: setup },
      { page: errors, section: shape },
      { page: logging, section: levels },
    ]);
    expect(groups.map(({ page, sections }) => [page.id, sections.map((s) => s.id)])).toEqual([
      ['logging', ['setup', 'levels']],
      ['error-handling', ['shape']],
    ]);
    expect(groupByPage([])).toEqual([]);
  });
});

describe('blockWords', () => {
  it('drops the backticks around code names', () => {
    expect(plainText('Uses `pino` and `pino-http`.')).toBe('Uses pino and pino-http.');
  });

  it('gives the words of every kind of block', () => {
    const blocks: DocBlock[] = [
      { kind: 'text', text: 'One `logger` per app.' },
      { kind: 'list', items: ['first', 'second'] },
      { kind: 'fields', fields: [{ label: 'Why', text: 'Because `x`.' }] },
      { kind: 'table', columns: ['Level', 'Use'], rows: [['info', 'normal']] },
      { kind: 'quote', file: 'a/b.ts', text: 'const x = 1;', caption: 'The `x`' },
      { kind: 'packages' },
    ];
    expect(blocks.map(blockWords)).toEqual([
      ['One logger per app.'],
      ['first', 'second'],
      ['Why', 'Because x.'],
      ['Level', 'Use', 'info', 'normal'],
      ['a/b.ts', 'The x', 'const x = 1;'],
      [],
    ]);
  });
});

describe('frameLabels', () => {
  const quote = (file: string): DocBlock => ({ kind: 'quote', file, text: 'x' });
  const table: DocBlock = { kind: 'table', columns: ['A'], rows: [['1']] };

  it('names tables and quotes after their section, and nothing else', () => {
    const blocks: DocBlock[] = [{ kind: 'text', text: 'Hi' }, table, quote('a/b.ts')];
    expect(frameLabels({ title: 'Setup', blocks })).toEqual([
      undefined,
      'Setup, table',
      'Setup: quoted from a/b.ts',
    ]);
  });

  it('numbers frames that would share a name in one section', () => {
    const blocks = [quote('a/b.ts'), quote('c.ts'), quote('a/b.ts'), table, table];
    expect(frameLabels({ title: 'Setup', blocks })).toEqual([
      'Setup: quoted from a/b.ts (1 of 2)',
      'Setup: quoted from c.ts',
      'Setup: quoted from a/b.ts (2 of 2)',
      'Setup, table (1 of 2)',
      'Setup, table (2 of 2)',
    ]);
  });
});

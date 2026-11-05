import { describe, expect, it } from 'vitest';
import type { ArchComponent, ArchLink, Flow, FlowStep } from '../data/schema.ts';
import type { IndexedSymbol } from '../data/source-index.ts';
import type { ComponentConnection, StepNeighbour } from '../model/docs-model.ts';
import {
  connectionKey,
  describeLine,
  fileLocation,
  fileName,
  groupExternalCalls,
  groupUsagesByFlow,
  hasSymbolFacts,
  keyedStrings,
  lineKey,
  lineRange,
  pathInside,
  splitConnections,
  splitInlineCode,
  splitSymbolId,
  stepLocation,
  stepNavTarget,
  stepPosition,
  symbolDisplayName,
  symbolFactsTitle,
} from './format.ts';

function step(id: string): FlowStep {
  return { id, title: id, kind: 'function', status: 'verified', what: id, why: id };
}

function flow(id: string, stepIds: string[]): Flow {
  return {
    id,
    title: id,
    category: 'api',
    apps: [],
    summary: id,
    status: 'verified',
    steps: stepIds.map(step),
  };
}

function symbol(overrides: Partial<IndexedSymbol> = {}): IndexedSymbol {
  return {
    id: 'a.ts#a',
    name: 'a',
    kind: 'interface',
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

function component(id: string): ArchComponent {
  return { id, name: id, kind: 'app', status: 'verified', summary: id, responsibilities: [] };
}

describe('locations', () => {
  it('writes one line or a range', () => {
    expect(lineRange(24, 24)).toBe('24');
    expect(lineRange(24, 57)).toBe('24–57');
    expect(fileLocation('backend/shared/src/service.ts', 24)).toBe(
      'backend/shared/src/service.ts:24',
    );
    expect(fileLocation('backend/shared/src/service.ts', 24, 57)).toBe(
      'backend/shared/src/service.ts:24–57',
    );
  });

  it('takes the file name from a path', () => {
    expect(fileName('backend/gateway/src/index.ts')).toBe('index.ts');
    expect(fileName('index.ts')).toBe('index.ts');
  });

  it('shortens a path to its place inside a folder', () => {
    expect(pathInside('backend/shared/src/env.ts', 'backend/shared')).toBe('src/env.ts');
    expect(pathInside('backend/shared-extra/x.ts', 'backend/shared')).toBe(
      'backend/shared-extra/x.ts',
    );
    expect(pathInside('frontend/x.ts', undefined)).toBe('frontend/x.ts');
  });

  it('names the function around a one-line step, so its range is not read as the step', () => {
    const healthRouter = symbol({
      kind: 'function',
      name: 'healthRouter',
      startLine: 13,
      endLine: 44,
    });
    expect(stepLocation(healthRouter, 'backend/shared/src/health.ts', true)).toBe(
      'in healthRouter · backend/shared/src/health.ts:13–44',
    );
    expect(stepLocation(healthRouter, 'backend/shared/src/health.ts', false)).toBe(
      'backend/shared/src/health.ts:13–44',
    );
    expect(
      stepLocation(symbol({ kind: 'module', name: '(module)' }), 'backend/auth/src/index.ts', true),
    ).toBe('in index.ts (top level) · backend/auth/src/index.ts:1–3');
  });

  it('splits a symbol id into its file and name', () => {
    expect(splitSymbolId('backend/shared/src/errors.ts#AppError.constructor')).toEqual({
      filePath: 'backend/shared/src/errors.ts',
      name: 'AppError.constructor',
    });
    expect(splitSymbolId('no-hash')).toEqual({ filePath: 'no-hash', name: 'no-hash' });
  });
});

describe('symbol names and facts', () => {
  it('names top-level code after its file', () => {
    expect(
      symbolDisplayName({ kind: 'module', name: '(module)' }, 'backend/gateway/src/index.ts'),
    ).toBe('index.ts (top level)');
    expect(symbolDisplayName({ kind: 'function', name: 'createService' }, 'x.ts')).toBe(
      'createService',
    );
  });

  it('titles the facts block by kind', () => {
    expect(symbolFactsTitle('function')).toBe('Function details');
    expect(symbolFactsTitle('method')).toBe('Function details');
    expect(symbolFactsTitle('const')).toBe('Constant details');
    expect(symbolFactsTitle('type')).toBe('Type details');
  });

  it('knows when the index has nothing more to say', () => {
    expect(hasSymbolFacts(symbol())).toBe(false);
    expect(hasSymbolFacts(symbol({ calledBy: ['b.ts#b'] }))).toBe(true);
    expect(hasSymbolFacts(symbol({ valueType: 'number' }))).toBe(true);
    expect(hasSymbolFacts(symbol({ params: [] }))).toBe(false);
  });

  it('groups outside calls by package without repeating names', () => {
    expect(
      groupExternalCalls([
        { package: 'express', name: 'express' },
        { package: 'helmet', name: 'helmet' },
        { package: 'express', name: 'json' },
        { package: 'express', name: 'json' },
      ]),
    ).toEqual([
      { package: 'express', names: ['express', 'json'] },
      { package: 'helmet', names: ['helmet'] },
    ]);
  });
});

describe('flow steps', () => {
  const health = flow('health', ['caller', 'request-id', 'response']);

  it('finds the position of a step in the list', () => {
    expect(stepPosition(health, 'caller')).toEqual({ number: 1, total: 3 });
    expect(stepPosition(health, 'response')).toEqual({ number: 3, total: 3 });
    expect(stepPosition(health, 'missing')).toBeUndefined();
  });

  describe('where Previous and Next go', () => {
    const neighbour = (id: string, label?: string): StepNeighbour => ({
      step: step(id),
      line: { from: 'here', to: id, kind: 'branch', label },
    });

    it('opens the only step on the other side', () => {
      expect(stepNavTarget([neighbour('decide')])).toEqual({ kind: 'one', step: step('decide') });
    });

    it('has no single target when the flow splits or paths meet', () => {
      expect(stepNavTarget([neighbour('ping-mongo'), neighbour('ping-redis')])).toEqual({
        kind: 'several',
        count: 2,
      });
    });

    it('has none at the start of the flow or the end of a path', () => {
      expect(stepNavTarget([])).toEqual({ kind: 'none' });
    });

    it('counts two lines to the same step once', () => {
      expect(stepNavTarget([neighbour('decide', 'ok'), neighbour('decide', 'failed')])).toEqual({
        kind: 'one',
        step: step('decide'),
      });
    });
  });

  it('describes lines: plain next steps need no kind', () => {
    expect(describeLine({ from: 'a', to: 'b', kind: 'next' })).toEqual({
      kindLabel: undefined,
      condition: undefined,
    });
    expect(describeLine({ from: 'a', to: 'b', kind: 'next', label: 'no route answered' })).toEqual({
      kindLabel: undefined,
      condition: 'no route answered',
    });
    expect(describeLine({ from: 'a', to: 'b', kind: 'error', label: 'next(err)' })).toEqual({
      kindLabel: 'Error path',
      condition: 'next(err)',
    });
    expect(describeLine({ from: 'a', to: 'b', kind: 'async' }).kindLabel).toBe('Finishes later');
  });

  it('keys lines apart when only the label differs', () => {
    expect(lineKey({ from: 'a', to: 'b', kind: 'branch', label: 'x' })).not.toBe(
      lineKey({ from: 'a', to: 'b', kind: 'branch', label: 'y' }),
    );
  });

  it('groups usages by flow and leaves out the open step', () => {
    const readiness = flow('readiness', ['request-id', 'checks']);
    const usages = [
      { flow: health, step: health.steps[1] as FlowStep },
      { flow: readiness, step: readiness.steps[0] as FlowStep },
      { flow: readiness, step: readiness.steps[1] as FlowStep },
    ];
    const groups = groupUsagesByFlow(usages, { flowId: 'health', stepId: 'request-id' });
    expect(groups.map((group) => group.flow.id)).toEqual(['readiness']);
    expect(groups[0]?.steps.map((s) => s.id)).toEqual(['request-id', 'checks']);
    expect(groupUsagesByFlow(usages)).toHaveLength(2);
  });
});

describe('connections and keys', () => {
  const link: ArchLink = {
    from: 'gateway',
    to: 'shared',
    kind: 'internal',
    label: 'imports',
    status: 'verified',
  };
  const connections: ComponentConnection[] = [
    { link, other: component('shared'), direction: 'out' },
    {
      link: { ...link, from: 'browser', to: 'gateway' },
      other: component('browser'),
      direction: 'in',
    },
  ];

  it('splits connections by direction', () => {
    const { incoming, outgoing } = splitConnections(connections);
    expect(incoming.map((c) => c.other.id)).toEqual(['browser']);
    expect(outgoing.map((c) => c.other.id)).toEqual(['shared']);
  });

  it('gives each connection its own key', () => {
    const keys = connections.map(connectionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keys repeated strings apart', () => {
    expect(keyedStrings(['a', 'b', 'a']).map((item) => item.key)).toEqual(['a', 'b', 'a#2']);
  });
});

describe('inline code', () => {
  it('splits text on backticks', () => {
    expect(splitInlineCode('Calls `storage.run(context, fn)` once.')).toEqual([
      { offset: 0, text: 'Calls ', code: false },
      { offset: 6, text: 'storage.run(context, fn)', code: true },
      { offset: 32, text: ' once.', code: false },
    ]);
  });

  it('keeps plain text and unmatched backticks as they are', () => {
    expect(splitInlineCode('no code here')).toEqual([
      { offset: 0, text: 'no code here', code: false },
    ]);
    expect(splitInlineCode('`as const` keeps a ` alone')).toEqual([
      { offset: 0, text: 'as const', code: true },
      { offset: 10, text: ' keeps a ` alone', code: false },
    ]);
    expect(splitInlineCode('')).toEqual([]);
  });
});

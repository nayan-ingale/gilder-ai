import { describe, expect, it } from 'vitest';
import { docs } from '../model/index.ts';
import { fileRoutes, fileUsages, groupSymbolsByKind, languageLabel } from './file-facts.ts';

// Runs against the real docs and code index.
const HEALTH = 'backend/shared/src/health.ts';

function healthFile() {
  const file = docs.getFile(HEALTH);
  if (!file) throw new Error(`${HEALTH} is not in the code index`);
  return file;
}

describe('groupSymbolsByKind', () => {
  it('groups by kind in a fixed order, each group in line order', () => {
    const groups = groupSymbolsByKind(healthFile().symbols);
    expect(groups.map((group) => group.kind)).toEqual(['function', 'const', 'type']);
    expect(groups[0]?.symbols.map((symbol) => symbol.name)).toEqual([
      'healthRouter',
      'withTimeout',
    ]);
  });

  it('gives nothing for a file without symbols', () => {
    expect(groupSymbolsByKind([])).toEqual([]);
  });
});

describe('fileRoutes', () => {
  it('lists the routes a file registers, with the flow documented for each', () => {
    const routes = fileRoutes(healthFile());
    expect(
      routes.map((route) => [`${route.method} ${route.path}`, route.flow?.id, route.symbolId]),
    ).toEqual([
      ['GET /healthz', 'health-check', `${HEALTH}#healthRouter`],
      ['GET /readyz', 'readiness-check', `${HEALTH}#healthRouter`],
    ]);
    expect(routes.map((route) => route.line)).toEqual(
      [...routes.map((route) => route.line)].sort((a, b) => a - b),
    );
  });

  it('leaves the flow out when none has the route', () => {
    const routes = fileRoutes(healthFile(), { flowForRoute: () => undefined });
    expect(routes.every((route) => route.flow === undefined)).toBe(true);
  });
});

describe('fileUsages', () => {
  it('finds the flow steps whose code is in the file', () => {
    const usages = fileUsages(HEALTH, docs.flows);
    expect(usages.length).toBeGreaterThan(0);
    expect(usages.every(({ step }) => step.symbol?.startsWith(`${HEALTH}#`))).toBe(true);
    expect(usages.map(({ flow }) => flow.id)).toContain('health-check');
  });

  it('finds nothing for a file no flow runs', () => {
    expect(fileUsages('frontend/src/app/layout.tsx', docs.flows)).toEqual([]);
  });
});

describe('languageLabel', () => {
  it('names the language', () => {
    expect(languageLabel('ts')).toBe('TypeScript');
    expect(languageLabel('tsx')).toBe('TypeScript with JSX');
  });
});

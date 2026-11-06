// What the file view says about one source file: its symbols grouped by kind, the routes it
// registers (with the documented flow for each, when there is one) and the flow steps that run
// its code. Pure, so it can be tested against the real docs without rendering.
import type { Flow } from '../data/schema.ts';
import type { IndexedFile, IndexedSymbol, SymbolKind } from '../data/source-index.ts';
import { splitSymbolId } from '../details/format.ts';
import type { DocsModel, StepUsage } from '../model/docs-model.ts';
import { docs } from '../model/index.ts';

/** The order of the kind groups, and each group's heading. */
export const KIND_GROUPS: readonly { kind: SymbolKind; title: string }[] = [
  { kind: 'function', title: 'Functions' },
  { kind: 'class', title: 'Classes' },
  { kind: 'method', title: 'Methods' },
  { kind: 'const', title: 'Constants' },
  { kind: 'interface', title: 'Interfaces' },
  { kind: 'type', title: 'Types' },
  { kind: 'module', title: 'Top-level code' },
];

export interface SymbolGroup {
  kind: SymbolKind;
  title: string;
  /** In line order. */
  symbols: IndexedSymbol[];
}

/** A file's symbols by kind, in KIND_GROUPS order. Kinds with no symbols are left out. */
export function groupSymbolsByKind(symbols: IndexedSymbol[]): SymbolGroup[] {
  const sorted = [...symbols].sort((a, b) => a.startLine - b.startLine);
  return KIND_GROUPS.map(({ kind, title }) => ({
    kind,
    title,
    symbols: sorted.filter((symbol) => symbol.kind === kind),
  })).filter((group) => group.symbols.length > 0);
}

export interface FileRoute {
  method: string;
  path: string;
  line: number;
  /** The symbol whose code registers it. */
  symbolId: string;
  /** The documented flow for this method and path, if there is one. */
  flow?: Flow;
}

/** Every route registered in the file, in line order. */
export function fileRoutes(
  file: IndexedFile,
  model: Pick<DocsModel, 'flowForRoute'> = docs,
): FileRoute[] {
  return file.symbols
    .flatMap((symbol) =>
      symbol.routes.map((route): FileRoute => ({
        ...route,
        symbolId: symbol.id,
        flow: model.flowForRoute(route.method, route.path),
      })),
    )
    .sort((a, b) => a.line - b.line);
}

/** A stable React key for a route. */
export function routeKey(route: Pick<FileRoute, 'method' | 'path' | 'line'>): string {
  return `${route.method} ${route.path}:${route.line}`;
}

/** The flow steps whose code is in the file, in flow order. */
export function fileUsages(filePath: string, flows: Flow[]): StepUsage[] {
  return flows.flatMap((flow) =>
    flow.steps
      .filter(
        (step) => step.symbol !== undefined && splitSymbolId(step.symbol).filePath === filePath,
      )
      .map((step) => ({ flow, step })),
  );
}

/** The language of a file, as people say it. */
export function languageLabel(language: IndexedFile['language']): string {
  return language === 'tsx' ? 'TypeScript with JSX' : 'TypeScript';
}

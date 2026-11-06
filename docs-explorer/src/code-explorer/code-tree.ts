// The code explorer's tree: every indexed file grouped by app, with the symbols inside each
// file in line order, and the filter over it. Pure, so the grouping and the filter rules can be
// tested against the real index without rendering.
import type { SymbolKind } from '../data/source-index.ts';
import { pathInside, symbolDisplayName } from '../details/format.ts';
import type { DocsModel } from '../model/docs-model.ts';
import { docs } from '../model/index.ts';
import { SYMBOL_KIND_LABEL } from '../model/labels.ts';

/** The order of the app groups: the browser-facing app first, the shared library last. */
export const APP_ORDER: readonly string[] = [
  'frontend',
  'gateway',
  'auth',
  'chat',
  'agent',
  'billing',
  'shared',
];

export interface TreeSymbol {
  id: string;
  /** As the UI names it everywhere: a file's top-level code is `index.ts (top level)`. */
  name: string;
  kind: SymbolKind;
  line: number;
  /** The HTTP routes it registers, written as `GET /readyz`. */
  routes: string[];
  /** Lower-case text the filter looks in: names, kind, routes and signature. */
  searchText: string;
}

export interface TreeFile {
  path: string;
  /** Its path inside its app's folder, such as `src/health.ts`. */
  label: string;
  /** In line order. */
  symbols: TreeSymbol[];
  /** Lower-case text the filter looks in: the full path. */
  searchText: string;
}

export interface TreeApp {
  /** The app as the code index names it: frontend, gateway, shared... */
  app: string;
  /** The name of the part of the system whose folder holds the app, or the app itself. */
  title: string;
  /** The app's folder, such as `backend/gateway`, when the docs know it. */
  folder?: string;
  files: TreeFile[];
}

export interface CodeTree {
  apps: TreeApp[];
  fileCount: number;
  symbolCount: number;
}

type TreeModel = Pick<DocsModel, 'files' | 'componentOfFile'>;

/** A file's path inside its app's folder (`src/health.ts`), or its full path outside any. */
export function fileLabel(
  filePath: string,
  model: Pick<DocsModel, 'componentOfFile'> = docs,
): string {
  return pathInside(filePath, model.componentOfFile(filePath)?.path);
}

function appRank(app: string): number {
  const rank = APP_ORDER.indexOf(app);
  return rank === -1 ? APP_ORDER.length : rank;
}

function countsOf(apps: TreeApp[]): Pick<CodeTree, 'fileCount' | 'symbolCount'> {
  const files = apps.flatMap((app) => app.files);
  return {
    fileCount: files.length,
    symbolCount: files.reduce((total, file) => total + file.symbols.length, 0),
  };
}

/** Groups the indexed files by app, in APP_ORDER (any other app after them, by name). */
export function buildCodeTree(model: TreeModel = docs): CodeTree {
  const byApp = new Map<string, TreeApp>();

  for (const file of model.files) {
    let group = byApp.get(file.app);
    if (!group) {
      const owner = model.componentOfFile(file.path);
      group = { app: file.app, title: owner?.name ?? file.app, folder: owner?.path, files: [] };
      byApp.set(file.app, group);
    }

    const symbols = [...file.symbols]
      .sort((a, b) => a.startLine - b.startLine)
      .map((symbol): TreeSymbol => {
        const name = symbolDisplayName(symbol, file.path);
        const routes = symbol.routes.map((route) => `${route.method} ${route.path}`);
        const searchText = [
          symbol.name,
          name,
          symbol.kind,
          SYMBOL_KIND_LABEL[symbol.kind],
          ...routes,
          symbol.signature ?? '',
        ]
          .join('\n')
          .toLowerCase();
        return {
          id: symbol.id,
          name,
          kind: symbol.kind,
          line: symbol.startLine,
          routes,
          searchText,
        };
      });

    group.files.push({
      path: file.path,
      label: fileLabel(file.path, model),
      symbols,
      searchText: file.path.toLowerCase(),
    });
  }

  const apps = [...byApp.values()]
    .sort((a, b) => appRank(a.app) - appRank(b.app) || a.app.localeCompare(b.app))
    .map((group) => ({
      ...group,
      files: group.files.sort((a, b) => a.label.localeCompare(b.label)),
    }));
  return { apps, ...countsOf(apps) };
}

/**
 * Keeps what matches `query`, ignoring case. Each word of the query must appear somewhere in a
 * file's path, or in a symbol's name, kind, routes (`GET /readyz`) or signature together with
 * its file's path. A file whose path matches keeps all its symbols; a matching symbol keeps its
 * file. An empty query keeps everything.
 */
export function filterTree(tree: CodeTree, query: string): CodeTree {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return tree;
  const matches = (text: string): boolean => words.every((word) => text.includes(word));

  const apps = tree.apps.flatMap((app): TreeApp[] => {
    const files = app.files.flatMap((file): TreeFile[] => {
      if (matches(file.searchText)) return [file];
      const symbols = file.symbols.filter((symbol) =>
        matches(`${file.searchText}\n${symbol.searchText}`),
      );
      return symbols.length > 0 ? [{ ...file, symbols }] : [];
    });
    return files.length > 0 ? [{ ...app, files }] : [];
  });
  return { apps, ...countsOf(apps) };
}

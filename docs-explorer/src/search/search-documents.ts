// What global search can find: one entry per page, flow, flow step, architecture component,
// function or type, and source file, each with the page it opens. Pure and built from the docs
// model, so the tests can check every entry against the real data.
import { fileName, symbolDisplayName } from '../details/format.ts';
import type { DocsModel } from '../model/docs-model.ts';
import {
  COMPONENT_KIND_LABEL,
  FLOW_CATEGORY_LABEL,
  STEP_KIND_LABEL,
  SYMBOL_KIND_LABEL,
} from '../model/labels.ts';
import { NAV, paths, type NavItem } from '../routes.ts';

export type SearchType = 'page' | 'flow' | 'route' | 'step' | 'component' | 'symbol' | 'file';

export interface SearchDocument {
  /** Unique across all entries, e.g. `flow:health-check` or `symbol:<symbol id>`. */
  id: string;
  type: SearchType;
  title: string;
  /** Where it lives: a file path, the flow a step belongs to, a flow's category. May be empty. */
  subtitle: string;
  /** What it is, shown next to the title and searched too: "Page", "Middleware", "Data store". */
  label: string;
  /** More words to match on (summaries, signatures), never shown. */
  text: string;
  /** The page it opens, built with `paths` or taken from NAV. */
  to: string;
  /** A file's full path, so a query typed as a path (`src/health.ts`) can find the file. */
  path?: string;
}

/** An HTTP route found in the code, and the documented flow that follows it, if there is one. */
export interface RouteEntry {
  method: string;
  path: string;
  /** The symbol that registers it, e.g. `backend/shared/src/health.ts#healthRouter`. */
  symbolId: string;
  /** That symbol's name as the UI shows it. */
  symbolName: string;
  filePath: string;
  flowId?: string;
}

export type SearchModel = Pick<
  DocsModel,
  'components' | 'flows' | 'files' | 'getNote' | 'flowForRoute'
>;

const routeKey = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;

/** Every route the code registers, matched to the flow documented for it. */
export function routeEntries(model: Pick<DocsModel, 'files' | 'flowForRoute'>): RouteEntry[] {
  return model.files.flatMap((file) =>
    file.symbols.flatMap((symbol) =>
      symbol.routes.map((route) => ({
        method: route.method.toUpperCase(),
        path: route.path,
        symbolId: symbol.id,
        symbolName: symbolDisplayName(symbol, file.path),
        filePath: file.path,
        flowId: model.flowForRoute(route.method, route.path)?.id,
      })),
    ),
  );
}

/** The part of a path before its last `/`: `backend/shared/src/health.ts` → `backend/shared/src`. */
function folderOf(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

const words = (...parts: (string | undefined)[]): string =>
  parts.filter((part) => part !== undefined && part !== '').join(' ');

/**
 * Every searchable entry. A route that has a documented flow is found through that flow (its
 * title is the route), so the same route is never listed twice; a route with no flow gets its
 * own entry that opens the code that registers it.
 */
export function buildSearchDocuments(
  model: SearchModel,
  nav: readonly NavItem[] = NAV,
): SearchDocument[] {
  const routes = routeEntries(model);

  const pages = nav.map((item): SearchDocument => ({
    id: `page:${item.id}`,
    type: 'page',
    title: item.label,
    subtitle: '',
    label: 'Page',
    text: '',
    to: item.to,
  }));

  const flows = model.flows.map((flow): SearchDocument => {
    const registeredBy = routes
      .filter((route) => route.flowId === flow.id)
      .map((route) => words(route.symbolName, route.filePath));
    return {
      id: `flow:${flow.id}`,
      type: 'flow',
      title: flow.title,
      subtitle: FLOW_CATEGORY_LABEL[flow.category],
      label: 'Flow',
      text: words(
        flow.route ? routeKey(flow.route.method, flow.route.path) : undefined,
        flow.summary,
        ...registeredBy,
      ),
      to: paths.flow(flow.id),
    };
  });

  const undocumentedRoutes = routes
    .filter((route) => route.flowId === undefined)
    .map((route): SearchDocument => ({
      id: `route:${routeKey(route.method, route.path)}:${route.symbolId}`,
      type: 'route',
      title: routeKey(route.method, route.path),
      subtitle: `${route.symbolName} · ${route.filePath}`,
      label: 'Route',
      text: 'Route registered in the code, no flow documented yet',
      to: paths.code({ symbol: route.symbolId, file: route.filePath }),
    }));

  const steps = model.flows.flatMap((flow) =>
    flow.steps.map((step): SearchDocument => ({
      id: `step:${flow.id}/${step.id}`,
      type: 'step',
      title: step.title,
      subtitle: flow.title,
      label: STEP_KIND_LABEL[step.kind],
      text: '',
      to: paths.flow(flow.id, step.id),
    })),
  );

  const components = model.components.map((component): SearchDocument => ({
    id: `component:${component.id}`,
    type: 'component',
    title: component.name,
    subtitle: component.path ?? '',
    label: COMPONENT_KIND_LABEL[component.kind],
    text: component.summary,
    to: paths.architecture('system', component.id),
  }));

  const symbols = model.files.flatMap((file) =>
    file.symbols.map((symbol): SearchDocument => ({
      id: `symbol:${symbol.id}`,
      type: 'symbol',
      title: symbolDisplayName(symbol, file.path),
      subtitle: file.path,
      label: SYMBOL_KIND_LABEL[symbol.kind],
      text: words(symbol.signature, model.getNote(symbol.id)?.summary),
      to: paths.code({ symbol: symbol.id, file: file.path }),
    })),
  );

  const files = model.files.map((file): SearchDocument => ({
    id: `file:${file.path}`,
    type: 'file',
    title: fileName(file.path),
    subtitle: folderOf(file.path),
    label: 'File',
    text: words(file.path, file.app),
    to: paths.code({ file: file.path }),
    path: file.path,
  }));

  return [...pages, ...flows, ...undocumentedRoutes, ...steps, ...components, ...symbols, ...files];
}

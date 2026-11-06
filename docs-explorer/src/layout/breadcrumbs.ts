// The breadcrumb trail for the top bar, built from the URL alone: the section, then what is
// open in it (a component, a flow and its step, or a source file), then the open symbol. Names
// come from the docs, so the trail reads like the page. Pure, so it can be tested without
// rendering.
import { fileLabel } from '../code-explorer/code-tree.ts';
import { splitSymbolId, symbolDisplayName } from '../details/format.ts';
import { getArchView } from '../model/architecture-views.ts';
import type { DocsModel } from '../model/docs-model.ts';
import { docs } from '../model/index.ts';
import { NAV, SELECT, paths } from '../routes.ts';
import { pathParts, sectionOf } from './sections.ts';

export interface Crumb {
  label: string;
  /** Where the crumb leads. The last crumb is the current page and is not shown as a link. */
  to: string;
}

type BreadcrumbModel = Pick<
  DocsModel,
  'getComponent' | 'getFlow' | 'getStep' | 'getSymbol' | 'componentOfFile'
>;

const NOT_FOUND = 'Page not found';

/** A symbol's name as the UI shows it; the part after `#` when the index doesn't know it. */
export function symbolName(symbolId: string, model: Pick<DocsModel, 'getSymbol'> = docs): string {
  const located = model.getSymbol(symbolId);
  return located
    ? symbolDisplayName(located.symbol, located.file.path)
    : splitSymbolId(symbolId).name;
}

/** The trail for `pathname` and its `?query`. An id the docs don't know is shown as it is. */
export function buildBreadcrumbs(
  pathname: string,
  search: string,
  model: BreadcrumbModel = docs,
): Crumb[] {
  const here = `${pathname}${search}`;
  const section = NAV.find((item) => item.id === sectionOf(pathname, model));
  if (!section) return [{ label: NOT_FOUND, to: here }];

  const params = new URLSearchParams(search);
  const node = params.get(SELECT.node) ?? undefined;
  const step = params.get(SELECT.step) ?? undefined;
  const symbol = params.get(SELECT.symbol) ?? undefined;
  const file = params.get(SELECT.file) ?? undefined;
  const [first, second] = pathParts(pathname);
  const crumbs: Crumb[] = [{ label: section.label, to: section.to }];

  if (first === 'architecture') {
    const view = second === undefined ? undefined : getArchView(second);
    if (view && node) {
      crumbs.push({
        label: model.getComponent(node)?.name ?? node,
        to: paths.architecture(view.id, node),
      });
    }
  } else if (first === 'flows' && second !== undefined) {
    const flow = model.getFlow(second);
    if (!flow) return [...crumbs, { label: NOT_FOUND, to: here }];
    crumbs.push({ label: flow.title, to: paths.flow(flow.id) });
    if (step) {
      crumbs.push({
        label: model.getStep(flow.id, step)?.title ?? step,
        to: paths.flow(flow.id, step),
      });
    }
  } else if (first === 'code') {
    // A symbol's own file wins over ?file=, which can lag behind after a link in the panel.
    const filePath =
      (symbol === undefined ? undefined : model.getSymbol(symbol)?.file.path) ?? file;
    if (filePath)
      crumbs.push({ label: fileLabel(filePath, model), to: paths.code({ file: filePath }) });
  } else {
    // Lists and placeholders have nothing to select.
    return crumbs;
  }

  if (symbol) crumbs.push({ label: symbolName(symbol, model), to: here });
  return crumbs;
}

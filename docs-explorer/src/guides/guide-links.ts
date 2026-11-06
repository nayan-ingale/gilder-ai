// Where the docs pages lead and what their refs point at, worked out without rendering so the
// rules can be tested: a page opens at its own address, or inside the sidebar section it belongs
// to (the error-handling page opens Error Handling), and a ref links to where the explorer shows
// the thing, or is plain text when the explorer has nothing to open.
import type { ArchComponent, DocBlock, DocPage, DocRef, DocSection, Flow } from '../data/schema.ts';
import { fileName, splitInlineCode, symbolDisplayName } from '../details/format.ts';
import type { DocsModel } from '../model/docs-model.ts';
import { refKey, type DocSectionUsage } from '../model/guides.ts';
import { docs } from '../model/index.ts';
import { SELECT, paths } from '../routes.ts';

/** Where a docs page opens, scrolled to one of its sections when `sectionId` is given. */
export function pagePath(page: Pick<DocPage, 'id' | 'section'>, sectionId?: string): string {
  return page.section === 'errors' ? paths.errors(sectionId) : paths.doc(page.id, sectionId);
}

/** The element id of a docs section on the page, so `?section=` can find it. */
export function sectionElementId(sectionId: string): string {
  return `doc-section-${sectionId}`;
}

export type RefKind = 'component' | 'flow' | 'symbol' | 'file';

/** The order the kinds are listed in under "In the map", from the big picture down. */
export const REF_KIND_ORDER: readonly RefKind[] = ['component', 'flow', 'symbol', 'file'];

export const REF_KIND_LABEL: Record<RefKind, string> = {
  component: 'Parts',
  flow: 'Flows',
  symbol: 'Code',
  file: 'Files',
};

export function refKind(ref: DocRef): RefKind {
  if ('component' in ref) return 'component';
  if ('flow' in ref) return 'flow';
  if ('symbol' in ref) return 'symbol';
  return 'file';
}

/** Refs grouped by kind, in REF_KIND_ORDER, each listed once, in the order they are written. */
export function groupRefs(refs: readonly DocRef[]): { kind: RefKind; refs: DocRef[] }[] {
  const unique = [...new Map(refs.map((ref) => [refKey(ref), ref])).values()];
  return REF_KIND_ORDER.map((kind) => ({
    kind,
    refs: unique.filter((ref) => refKind(ref) === kind),
  })).filter((group) => group.refs.length > 0);
}

/** What a ref points at, found in the docs and the code index. */
export type ResolvedRef =
  | { kind: 'component'; component: ArchComponent }
  | { kind: 'flow'; flow: Flow; to: string }
  | { kind: 'symbol'; name: string; filePath: string; to: string }
  /** `to` only when the code index has the file; config files and the like have none. */
  | { kind: 'file'; path: string; to?: string }
  /** A component, flow or symbol the docs don't know: shown as its id, never as a dead link. */
  | { kind: 'unknown'; text: string };

type RefModel = Pick<DocsModel, 'getComponent' | 'getFlow' | 'getSymbol' | 'getFile'>;

export function resolveRef(ref: DocRef, model: RefModel = docs): ResolvedRef {
  if ('component' in ref) {
    const component = model.getComponent(ref.component);
    return component ? { kind: 'component', component } : { kind: 'unknown', text: ref.component };
  }
  if ('flow' in ref) {
    const flow = model.getFlow(ref.flow);
    return flow
      ? { kind: 'flow', flow, to: paths.flow(flow.id) }
      : { kind: 'unknown', text: ref.flow };
  }
  if ('symbol' in ref) {
    const located = model.getSymbol(ref.symbol);
    if (!located) return { kind: 'unknown', text: ref.symbol };
    const { symbol, file } = located;
    return {
      kind: 'symbol',
      name: symbolDisplayName(symbol, file.path),
      filePath: file.path,
      to: paths.code({ symbol: symbol.id, file: file.path }),
    };
  }
  return model.getFile(ref.file)
    ? { kind: 'file', path: ref.file, to: paths.code({ file: ref.file }) }
    : { kind: 'file', path: ref.file };
}

/** The file a symbol link names after it; nothing when the name already says it (top-level code). */
export function symbolFileHint(name: string, filePath: string): string | undefined {
  const file = fileName(filePath);
  return name.includes(file) ? undefined : file;
}

export interface PageSections {
  page: DocPage;
  sections: DocSection[];
}

/** Docs sections grouped under their page, pages in the order they first come. */
export function groupByPage(usages: DocSectionUsage[]): PageSections[] {
  const groups = new Map<string, PageSections>();
  for (const { page, section } of usages) {
    const group = groups.get(page.id);
    if (group) group.sections.push(section);
    else groups.set(page.id, { page, sections: [section] });
  }
  return [...groups.values()];
}

/**
 * The names of a section's scrolling frames, one per block: tables and quotes get one, other
 * blocks none. Screen readers list the frames as landmarks, so each name says its section, and
 * frames that would share a name in one section are numbered.
 */
export function frameLabels(section: Pick<DocSection, 'title' | 'blocks'>): (string | undefined)[] {
  const names = section.blocks.map((block) => {
    if (block.kind === 'table') return `${section.title}, table`;
    if (block.kind === 'quote') return `${section.title}: quoted from ${block.file}`;
    return undefined;
  });
  const totals = new Map<string, number>();
  for (const name of names) if (name !== undefined) totals.set(name, (totals.get(name) ?? 0) + 1);
  const numbered = new Map<string, number>();
  return names.map((name) => {
    const total = name === undefined ? 0 : (totals.get(name) ?? 0);
    if (name === undefined || total < 2) return name;
    const number = (numbered.get(name) ?? 0) + 1;
    numbered.set(name, number);
    return `${name} (${number} of ${total})`;
  });
}

/**
 * Where a docs page sends a visit to its own address instead: a page shown inside a sidebar
 * section (the error-handling page, under Error Handling) opens there, at the same section.
 * Undefined for a page shown at its own address.
 */
export function redirectPath(
  page: Pick<DocPage, 'id' | 'section'>,
  params: URLSearchParams,
): string | undefined {
  if (page.section === undefined) return undefined;
  return pagePath(page, params.get(SELECT.section) ?? undefined);
}

/** Hand-written text as it reads, with the backticks around code names dropped. */
export function plainText(text: string): string {
  return splitInlineCode(text)
    .map((part) => part.text)
    .join('');
}

/**
 * The words of a block, for search. A quote counts its file and caption as well as its text;
 * the package table has no words of its own (search adds the packages separately).
 */
export function blockWords(block: DocBlock): string[] {
  switch (block.kind) {
    case 'text':
      return [plainText(block.text)];
    case 'list':
      return block.items.map(plainText);
    case 'fields':
      return block.fields.flatMap((field) => [field.label, plainText(field.text)]);
    case 'table':
      return [...block.columns, ...block.rows.flat()].map(plainText);
    case 'quote':
      return [block.file, ...(block.caption ? [plainText(block.caption)] : []), block.text];
    case 'packages':
      return [];
  }
}

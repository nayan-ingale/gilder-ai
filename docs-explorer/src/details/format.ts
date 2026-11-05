// Pure helpers for the detail panel: how locations, names, flow lines and grouped lists are
// worded and ordered. Kept out of the components so they can be tested without rendering.
import type { Flow, FlowStep } from '../data/schema.ts';
import type { ExternalCall, IndexedSymbol, SymbolKind } from '../data/source-index.ts';
import type {
  ComponentConnection,
  FlowLine,
  StepNeighbour,
  StepUsage,
} from '../model/docs-model.ts';
import { EDGE_KIND_LABEL } from '../model/labels.ts';

/** `24–57`, or just `24` when the range is one line. */
export function lineRange(startLine: number, endLine: number): string {
  return startLine === endLine ? String(startLine) : `${startLine}–${endLine}`;
}

/** `backend/shared/src/service.ts:24–57`, or `…:24` without an end line. */
export function fileLocation(filePath: string, startLine: number, endLine?: number): string {
  return `${filePath}:${endLine === undefined ? startLine : lineRange(startLine, endLine)}`;
}

/** The last part of a path: `backend/gateway/src/index.ts` → `index.ts`. */
export function fileName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1);
}

/** A file's path inside a folder: `backend/shared/src/env.ts` in `backend/shared` → `src/env.ts`. */
export function pathInside(filePath: string, folder: string | undefined): string {
  return folder && filePath.startsWith(`${folder}/`) ? filePath.slice(folder.length + 1) : filePath;
}

/** Splits a symbol ID (`<file path>#<name>`) into its file and name. */
export function splitSymbolId(id: string): { filePath: string; name: string } {
  const hash = id.indexOf('#');
  return hash === -1
    ? { filePath: id, name: id }
    : { filePath: id.slice(0, hash), name: id.slice(hash + 1) };
}

/**
 * The name to show for a symbol. The index calls a file's top-level code `(module)`, which says
 * nothing on its own, so it is shown with its file name instead.
 */
export function symbolDisplayName(
  symbol: Pick<IndexedSymbol, 'kind' | 'name'>,
  filePath: string,
): string {
  return symbol.kind === 'module' ? `${fileName(filePath)} (top level)` : symbol.name;
}

/** The title of the block of facts the index has about a symbol. */
export function symbolFactsTitle(kind: SymbolKind): string {
  switch (kind) {
    case 'function':
    case 'method':
      return 'Function details';
    case 'class':
      return 'Class details';
    case 'const':
      return 'Constant details';
    case 'interface':
    case 'type':
      return 'Type details';
    case 'module':
      return 'Code details';
  }
}

/** Whether the index knows anything about the symbol beyond its name and lines. */
export function hasSymbolFacts(symbol: IndexedSymbol): boolean {
  return (
    symbol.signature !== undefined ||
    (symbol.params?.length ?? 0) > 0 ||
    symbol.returnType !== undefined ||
    symbol.valueType !== undefined ||
    symbol.routes.length > 0 ||
    symbol.externalCalls.length > 0 ||
    symbol.calls.length > 0 ||
    symbol.calledBy.length > 0
  );
}

/**
 * Where a step's code is, for the step's header. A step that is one line inside a function also
 * names the function, so the function's range isn't read as the step's own lines.
 */
export function stepLocation(
  symbol: Pick<IndexedSymbol, 'kind' | 'name' | 'startLine' | 'endLine'>,
  filePath: string,
  oneLine: boolean,
): string {
  const location = fileLocation(filePath, symbol.startLine, symbol.endLine);
  return oneLine ? `in ${symbolDisplayName(symbol, filePath)} · ${location}` : location;
}

export interface StepPosition {
  /** 1-based, as shown to people. */
  number: number;
  total: number;
}

/** Where a step sits in its flow's list. */
export function stepPosition(flow: Flow, stepId: string): StepPosition | undefined {
  const index = flow.steps.findIndex((step) => step.id === stepId);
  return index === -1 ? undefined : { number: index + 1, total: flow.steps.length };
}

/** Where a Previous or Next button can go from a step. */
export type StepNavTarget =
  { kind: 'one'; step: FlowStep } | { kind: 'several'; count: number } | { kind: 'none' };

/**
 * Follows the lines of a flow, not its list order: the one step at the other end, if there is
 * exactly one. Several (branches, checks run at once, paths that meet) give no single target;
 * none means the start of the flow or the end of a path. Two lines to one step count once.
 */
export function stepNavTarget(neighbours: StepNeighbour[]): StepNavTarget {
  const steps = [...new Map(neighbours.map(({ step }) => [step.id, step])).values()];
  const [only] = steps;
  if (steps.length === 1 && only) return { kind: 'one', step: only };
  return steps.length === 0 ? { kind: 'none' } : { kind: 'several', count: steps.length };
}

/**
 * What to say about a line between two steps. A plain "next step" line needs no words; any
 * other kind is named, and its label is the condition or reason it is taken.
 */
export function describeLine(line: FlowLine): { kindLabel?: string; condition?: string } {
  return {
    kindLabel: line.kind === 'next' ? undefined : EDGE_KIND_LABEL[line.kind],
    condition: line.label,
  };
}

/** A stable React key for a line between two steps. */
export function lineKey(line: FlowLine): string {
  return `${line.from}>${line.to}:${line.kind}:${line.label ?? ''}`;
}

export interface FlowUsageGroup {
  flow: Flow;
  steps: FlowStep[];
}

/**
 * Groups flow steps by their flow, keeping the order they come in. `exclude` leaves out one
 * step (the one already open), and a flow left with no steps is dropped.
 */
export function groupUsagesByFlow(
  usages: StepUsage[],
  exclude?: { flowId: string; stepId: string },
): FlowUsageGroup[] {
  const groups = new Map<string, FlowUsageGroup>();
  for (const { flow, step } of usages) {
    if (exclude && flow.id === exclude.flowId && step.id === exclude.stepId) continue;
    const group = groups.get(flow.id);
    if (group) group.steps.push(step);
    else groups.set(flow.id, { flow, steps: [step] });
  }
  return [...groups.values()];
}

/** Calls into outside packages, one entry per package, names in the order they come. */
export function groupExternalCalls(calls: ExternalCall[]): { package: string; names: string[] }[] {
  const byPackage = new Map<string, string[]>();
  for (const call of calls) {
    const names = byPackage.get(call.package);
    if (!names) byPackage.set(call.package, [call.name]);
    else if (!names.includes(call.name)) names.push(call.name);
  }
  return [...byPackage].map(([name, names]) => ({ package: name, names }));
}

/** A component's connections, split into the ones that reach it and the ones it makes. */
export function splitConnections(connections: ComponentConnection[]): {
  incoming: ComponentConnection[];
  outgoing: ComponentConnection[];
} {
  return {
    incoming: connections.filter((connection) => connection.direction === 'in'),
    outgoing: connections.filter((connection) => connection.direction === 'out'),
  };
}

/** A stable React key for a component connection. */
export function connectionKey({ link, direction }: ComponentConnection): string {
  return `${direction}:${link.from}>${link.to}:${link.kind}:${link.label}`;
}

/**
 * Pairs each string in a list with a stable key: the string itself, with a count added when the
 * same text appears more than once.
 */
export function keyedStrings(values: string[]): { key: string; value: string }[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const count = (seen.get(value) ?? 0) + 1;
    seen.set(value, count);
    return { key: count === 1 ? value : `${value}#${count}`, value };
  });
}

export interface TextPart {
  /** Where the part starts in the original text: a stable key. */
  offset: number;
  text: string;
  /** Written between backticks in the docs, so shown in the code font. */
  code: boolean;
}

/**
 * Splits hand-written text on `backticks`, so code names inside sentences can be shown in the
 * code font. An unmatched backtick is kept as plain text.
 */
export function splitInlineCode(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /`([^`]+)`/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const code = match[1];
    if (code === undefined) continue;
    if (match.index > last)
      parts.push({ offset: last, text: text.slice(last, match.index), code: false });
    parts.push({ offset: match.index, text: code, code: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ offset: last, text: text.slice(last), code: false });
  return parts;
}

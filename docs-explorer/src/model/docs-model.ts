import type {
  ArchComponent,
  ArchLink,
  DocsData,
  EdgeKind,
  Flow,
  FlowStep,
  SymbolNote,
} from '../data/schema.ts';
import type { IndexedFile, IndexedSymbol, SourceIndex } from '../data/source-index.ts';

/**
 * Joins the hand-written docs (src/data/) with the generated source index, so views can ask
 * "which flows use this function?" or "which part of the system owns this file?" without
 * walking the data themselves. Built once from its inputs, so tests pass small made-up data.
 */

export interface LocatedSymbol {
  symbol: IndexedSymbol;
  file: IndexedFile;
}

/** One line in a flow graph: the step it leaves, the step it reaches, and how. */
export interface FlowLine {
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
}

/** A step next to another one in a flow, and the line that joins the two. */
export interface StepNeighbour {
  step: FlowStep;
  line: FlowLine;
}

export interface StepUsage {
  flow: Flow;
  step: FlowStep;
}

/** A link seen from one component: the component at the other end, and which way it points. */
export interface ComponentConnection {
  link: ArchLink;
  other: ArchComponent;
  direction: 'in' | 'out';
}

export interface DocsModel extends DocsData {
  files: IndexedFile[];
  getComponent(id: string): ArchComponent | undefined;
  getFlow(id: string): Flow | undefined;
  getStep(flowId: string, stepId: string): FlowStep | undefined;
  getSymbol(id: string): LocatedSymbol | undefined;
  getNote(symbolId: string): SymbolNote | undefined;
  getFile(path: string): IndexedFile | undefined;
  /** The component whose folder holds the file (the deepest one, when folders nest). */
  componentOfFile(path: string): ArchComponent | undefined;
  filesOf(componentId: string): IndexedFile[];
  connectionsOf(componentId: string): ComponentConnection[];
  /** Every line in the flow graph, including the implied "next step" ones. */
  flowLines(flow: Flow): FlowLine[];
  stepsBefore(flow: Flow, stepId: string): StepNeighbour[];
  stepsAfter(flow: Flow, stepId: string): StepNeighbour[];
  /** The flow steps that run this symbol. */
  usagesOf(symbolId: string): StepUsage[];
  /** The flows a component takes part in: it runs them, or one of their steps is its code. */
  flowsOf(componentId: string): Flow[];
}

export function createDocsModel(index: SourceIndex, docs: DocsData): DocsModel {
  const componentsById = new Map(docs.components.map((component) => [component.id, component]));
  const flowsById = new Map(docs.flows.map((flow) => [flow.id, flow]));
  const notesBySymbol = new Map(docs.notes.map((note) => [note.symbol, note]));
  const filesByPath = new Map(index.files.map((file) => [file.path, file]));
  const symbolsById = new Map<string, LocatedSymbol>();
  for (const file of index.files) {
    for (const symbol of file.symbols) {
      symbolsById.set(symbol.id, { symbol, file });
    }
  }

  // Deepest folder first, so a nested component wins over the one around it.
  const componentsByDepth = docs.components
    .filter((component) => component.path !== undefined)
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0));
  const componentOfFile = (path: string): ArchComponent | undefined =>
    componentsByDepth.find(
      (component) => path === component.path || path.startsWith(`${component.path}/`),
    );

  const flowLines = (flow: Flow): FlowLine[] =>
    flow.steps.flatMap((step, position) => {
      const following = flow.steps[position + 1];
      const edges = step.next ?? (following ? [{ to: following.id, kind: 'next' as const }] : []);
      return edges.map((edge) => ({ from: step.id, ...edge }));
    });

  const neighbours = (flow: Flow, stepId: string, side: 'from' | 'to'): StepNeighbour[] => {
    const other = side === 'to' ? 'from' : 'to';
    return flowLines(flow).flatMap((line) => {
      const step = line[side] === stepId ? flow.steps.find((s) => s.id === line[other]) : undefined;
      return step ? [{ step, line }] : [];
    });
  };

  const usagesOf = (symbolId: string): StepUsage[] =>
    docs.flows.flatMap((flow) =>
      flow.steps.filter((step) => step.symbol === symbolId).map((step) => ({ flow, step })),
    );

  return {
    ...docs,
    files: index.files,
    getComponent: (id) => componentsById.get(id),
    getFlow: (id) => flowsById.get(id),
    getStep: (flowId, stepId) => flowsById.get(flowId)?.steps.find((step) => step.id === stepId),
    getSymbol: (id) => symbolsById.get(id),
    getNote: (symbolId) => notesBySymbol.get(symbolId as SymbolNote['symbol']),
    getFile: (path) => filesByPath.get(path),
    componentOfFile,
    filesOf: (componentId) =>
      index.files.filter((file) => componentOfFile(file.path)?.id === componentId),
    connectionsOf: (componentId) =>
      docs.links.flatMap((link): ComponentConnection[] => {
        const direction = link.from === componentId ? 'out' : link.to === componentId ? 'in' : null;
        const other = componentsById.get(direction === 'out' ? link.to : link.from);
        return direction && other ? [{ link, other, direction }] : [];
      }),
    flowLines,
    stepsBefore: (flow, stepId) => neighbours(flow, stepId, 'to'),
    stepsAfter: (flow, stepId) => neighbours(flow, stepId, 'from'),
    usagesOf,
    flowsOf: (componentId) =>
      docs.flows.filter(
        (flow) =>
          flow.apps.includes(componentId) ||
          flow.steps.some((step) => {
            const filePath = step.symbol?.split('#')[0];
            return filePath !== undefined && componentOfFile(filePath)?.id === componentId;
          }),
      ),
  };
}

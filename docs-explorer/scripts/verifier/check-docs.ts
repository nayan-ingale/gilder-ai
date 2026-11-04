import type {
  ArchComponent,
  ArchLink,
  Flow,
  SymbolNote,
  SymbolRef,
} from '../../src/data/schema.ts';
import type { IndexedSymbol, SourceIndex } from '../../src/data/source-index.ts';

/** Everything hand-written in src/data/. */
export interface DocsData {
  components: ArchComponent[];
  links: ArchLink[];
  flows: Flow[];
  notes: SymbolNote[];
}

/** How the checker reads the repo. Tests pass in-memory files instead of the real disk. */
export interface RepoAccess {
  /** A file's text by its path from the repo root, or undefined when it doesn't exist. */
  readFile(filePath: string): string | undefined;
  exists(filePath: string): boolean;
}

export interface CheckResult {
  /** Mistakes: the docs say something the code contradicts. These fail the build. */
  problems: string[];
  /** Gaps worth fixing that don't make the docs wrong, such as a function with no note yet. */
  warnings: string[];
}

interface Located {
  symbol: IndexedSymbol;
  filePath: string;
}

/**
 * Compares the hand-written docs with the generated index of the real code. Every symbol a doc
 * points at must exist, every highlighted line must still be in that symbol's code, every route
 * must be registered in the code, and every link between docs must land somewhere real.
 */
export function checkDocs(index: SourceIndex, docs: DocsData, repo: RepoAccess): CheckResult {
  const symbols = new Map<string, Located>();
  for (const file of index.files) {
    for (const symbol of file.symbols) {
      symbols.set(symbol.id, { symbol, filePath: file.path });
    }
  }
  const problems: string[] = [];
  const checkRef = (where: string, ref: SymbolRef | undefined): void => {
    if (ref && !symbols.has(ref)) {
      problems.push(`${where}: no symbol ${ref} in the code`);
    }
  };

  checkArchitecture(docs, repo, checkRef, problems);
  checkFlows(index, docs.flows, symbols, repo, checkRef, problems);
  checkNotes(docs.notes, repo, checkRef, problems);

  return { problems, warnings: missingNotes(symbols, docs.notes) };
}

function checkArchitecture(
  { components, links }: DocsData,
  repo: RepoAccess,
  checkRef: (where: string, ref: SymbolRef | undefined) => void,
  problems: string[],
): void {
  const componentIds = new Set<string>();
  for (const component of components) {
    const where = `component ${component.id}`;
    if (componentIds.has(component.id)) {
      problems.push(`${where}: the id is used twice`);
    }
    componentIds.add(component.id);
    if (component.status === 'planned' && !component.plannedIn) {
      problems.push(`${where}: planned, but plannedIn doesn't name the feature that adds it`);
    }
    if (component.path && component.status !== 'planned' && !repo.exists(component.path)) {
      problems.push(`${where}: folder ${component.path} doesn't exist`);
    }
    for (const ref of component.entryPoints ?? []) {
      checkRef(where, ref);
    }
  }

  for (const link of links) {
    const where = `link ${link.from} → ${link.to}`;
    for (const end of [link.from, link.to]) {
      if (!componentIds.has(end)) {
        problems.push(`${where}: no component ${end}`);
      }
    }
    if (link.status === 'planned' && !link.plannedIn) {
      problems.push(`${where}: planned, but plannedIn doesn't name the feature that adds it`);
    }
    for (const ref of link.evidence ?? []) {
      checkRef(where, ref);
    }
  }
}

function checkFlows(
  index: SourceIndex,
  flows: Flow[],
  symbols: Map<string, Located>,
  repo: RepoAccess,
  checkRef: (where: string, ref: SymbolRef | undefined) => void,
  problems: string[],
): void {
  const apps = new Set(index.files.map((file) => file.app));
  const routes = new Set(
    index.files.flatMap((file) =>
      file.symbols.flatMap((symbol) =>
        symbol.routes.map((route) => `${route.method} ${route.path}`),
      ),
    ),
  );
  const flowIds = new Set<string>();

  for (const flow of flows) {
    const where = `flow ${flow.id}`;
    if (flowIds.has(flow.id)) {
      problems.push(`${where}: the id is used twice`);
    }
    flowIds.add(flow.id);
    if (flow.route && !routes.has(`${flow.route.method} ${flow.route.path}`)) {
      problems.push(`${where}: route ${flow.route.method} ${flow.route.path} isn't in the code`);
    }
    for (const app of flow.apps) {
      if (!apps.has(app)) {
        problems.push(`${where}: no app named ${app}`);
      }
    }

    const stepIds = new Set<string>();
    for (const step of flow.steps) {
      if (stepIds.has(step.id)) {
        problems.push(`${where}: step id ${step.id} is used twice`);
      }
      stepIds.add(step.id);
    }

    for (const step of flow.steps) {
      const stepWhere = `${where}, step ${step.id}`;
      checkRef(stepWhere, step.symbol);
      if (flow.status === 'verified' && step.symbol && step.status !== 'verified') {
        problems.push(`${stepWhere}: the flow is verified, but this step is ${step.status}`);
      }
      if (step.highlight) {
        const located = step.symbol ? symbols.get(step.symbol) : undefined;
        if (!step.symbol) {
          problems.push(`${stepWhere}: has a highlight but no symbol to find it in`);
        } else if (located && !codeOf(located, repo).includes(step.highlight)) {
          problems.push(`${stepWhere}: "${step.highlight}" is no longer in ${step.symbol}`);
        }
      }
      for (const edge of step.next ?? []) {
        if (!stepIds.has(edge.to)) {
          problems.push(`${stepWhere}: leads to step ${edge.to}, which doesn't exist`);
        }
      }
    }
  }
}

function checkNotes(
  notes: SymbolNote[],
  repo: RepoAccess,
  checkRef: (where: string, ref: SymbolRef | undefined) => void,
  problems: string[],
): void {
  const seen = new Set<string>();
  for (const note of notes) {
    const where = `note ${note.symbol}`;
    if (seen.has(note.symbol)) {
      problems.push(`${where}: written twice`);
    }
    seen.add(note.symbol);
    checkRef('note', note.symbol);
    for (const testFile of note.tests ?? []) {
      if (!repo.exists(testFile)) {
        problems.push(`${where}: test file ${testFile} doesn't exist`);
      }
    }
  }
}

/** Functions, classes, methods and constants in backend/shared that nobody has explained yet. */
function missingNotes(symbols: Map<string, Located>, notes: SymbolNote[]): string[] {
  const noted = new Set<string>(notes.map((note) => note.symbol));
  return [...symbols.values()]
    .filter(
      ({ symbol, filePath }) =>
        filePath.startsWith('backend/shared/') &&
        ['function', 'class', 'method', 'const'].includes(symbol.kind) &&
        !noted.has(symbol.id),
    )
    .map(({ symbol }) => `${symbol.id} has no note yet`);
}

/** The lines of a symbol's code, read from its file. */
function codeOf({ symbol, filePath }: Located, repo: RepoAccess): string {
  const lines = (repo.readFile(filePath) ?? '').split('\n');
  return lines.slice(symbol.startLine - 1, symbol.endLine).join('\n');
}

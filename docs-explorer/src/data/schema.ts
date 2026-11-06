/**
 * The shape of the hand-written documentation in src/data/: the architecture, the request flows
 * and the notes on each function. Facts about the code (signatures, line numbers, who calls
 * whom) are never written by hand; they come from the generated index (source-index.ts), and
 * everything here points at the code through symbol IDs.
 */

/** How sure the documentation is that it matches the code. Every node and link carries one. */
export type Status = 'verified' | 'partial' | 'inferred' | 'not-wired' | 'planned' | 'unknown';

export const STATUS_INFO: Record<Status, { label: string; description: string }> = {
  verified: {
    label: 'Verified',
    description: 'Traced in the code: the route, the functions and their order all exist.',
  },
  partial: {
    label: 'Partly verified',
    description: 'Some steps are traced in the code; the others are marked on their own.',
  },
  inferred: {
    label: 'Inferred',
    description: 'Follows from how the code is put together, but not traced line by line.',
  },
  'not-wired': {
    label: 'Not wired yet',
    description: 'Exists and works on its own, but no route or flow uses it yet.',
  },
  planned: {
    label: 'Planned',
    description: 'Designed but not built yet. The roadmap feature that adds it is named.',
  },
  unknown: {
    label: 'Unknown',
    description: 'Could not be traced in the code.',
  },
};

/**
 * A pointer to real code: a symbol ID from the generated index, such as
 * `backend/shared/src/health.ts#healthRouter`. The checker (scripts/verify-docs.ts) fails the
 * build if one points at code that doesn't exist.
 */
export type SymbolRef = `${string}#${string}`;

// ---------------------------------------------------------------------------------------------
// Architecture: the apps, data stores and outside services, and how they connect.

export type ComponentKind = 'client' | 'app' | 'library' | 'datastore' | 'external';

export interface ArchComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  status: Status;
  /** The roadmap feature that adds it, when it isn't built yet, e.g. "AI answers". */
  plannedIn?: string;
  /** One line: what it is for. */
  summary: string;
  responsibilities: string[];
  /** Its folder in the repo. Every indexed file under this folder belongs to this component. */
  path?: string;
  port?: number;
  /** The code to open first to understand it, such as its startup. */
  entryPoints?: SymbolRef[];
}

export type LinkKind = 'http' | 'internal' | 'data' | 'external';

export interface ArchLink {
  from: string;
  to: string;
  kind: LinkKind;
  /** What travels along the link, e.g. "every /api/* call". */
  label: string;
  status: Status;
  plannedIn?: string;
  /** The code that makes this connection, when it exists. */
  evidence?: SymbolRef[];
}

// ---------------------------------------------------------------------------------------------
// Flows: one request (or one lifecycle event, like startup) followed step by step through the
// code. Only built code gets a flow: a flow for something not built yet would be a guess.

export type FlowStatus = Exclude<Status, 'planned'>;

export type FlowCategory = 'api' | 'lifecycle' | 'errors';

export type StepKind =
  | 'trigger'
  | 'middleware'
  | 'handler'
  | 'function'
  | 'datastore'
  | 'external'
  | 'response'
  | 'error';

/**
 * How one step leads to another. The main path is the order of the steps list; `branch` is a
 * condition, `error` a failure path, `parallel` work that runs at the same time and `async`
 * work that finishes later.
 */
export type EdgeKind = 'next' | 'branch' | 'error' | 'parallel' | 'async';

export interface FlowEdge {
  to: string;
  kind: EdgeKind;
  /** The condition or reason, e.g. "every check passed". */
  label?: string;
}

export interface FlowStep {
  /** Unique within its flow. */
  id: string;
  title: string;
  kind: StepKind;
  status: FlowStatus;
  /** The code that runs here. Left out only for things outside our code, like the caller. */
  symbol?: SymbolRef;
  /**
   * Exact text from the symbol's code that this step is about, when the step is one line of a
   * bigger function (for example `app.use(helmet());`). Shown highlighted; the checker makes
   * sure the text is still there.
   */
  highlight?: string;
  /** What happens here, in simple English. */
  what: string;
  /** Why this step exists. */
  why: string;
  /** What this step receives. */
  input?: string;
  /** What it produces or hands on. */
  output?: string;
  sideEffects?: string[];
  /** Where the request can go from here. When left out, it goes to the next step in the list. */
  next?: FlowEdge[];
  /**
   * For a step whose lines are all `parallel`: the step where every piece of that work is done
   * and the flow goes on (where the code waits for all of it, such as after Promise.all). The
   * steps in between run once for each piece.
   */
  join?: string;
}

export interface Flow {
  id: string;
  title: string;
  category: FlowCategory;
  /** The HTTP route, when the flow is an API call. */
  route?: { method: string; path: string };
  /** The apps that run this flow, as named in the generated index (gateway, auth...). */
  apps: string[];
  summary: string;
  status: FlowStatus;
  steps: FlowStep[];
}

// ---------------------------------------------------------------------------------------------
// Notes: what a function is for, in words. Its signature, parameters, lines and callers come
// from the generated index, so a note only says what the code alone can't.

export interface SymbolNote {
  symbol: SymbolRef;
  status: Status;
  /** The roadmap feature that wires it in, when it's planned. */
  plannedIn?: string;
  /** One line: what it does. */
  summary: string;
  /** How it works, one sentence per step. */
  how?: string[];
  /** Why it exists: the problem it solves. */
  why: string;
  /** What it gives back, in words. */
  returns?: string;
  sideEffects?: string[];
  /** Test files that cover it, as paths from the repo root. */
  tests?: string[];
}

/** Everything hand-written in src/data/, as the explorer and the checker read it. */
export interface DocsData {
  components: ArchComponent[];
  links: ArchLink[];
  flows: Flow[];
  notes: SymbolNote[];
}

// ---------------------------------------------------------------------------------------------
// Docs pages: short written guides, such as the tech stack, the architecture decisions and how
// logging works. Each section names what it is about in the explorer, and quotes are checked
// against their files, so the build fails when a page stops matching the repo.

/** Something a docs section is about. Each one links to where the explorer shows it. */
export type DocRef =
  | { component: string }
  | { flow: string }
  | { symbol: SymbolRef }
  /** A file by its path from the repo root. Indexed source files open in the code explorer. */
  | { file: string };

export type DocBlock =
  /** A paragraph. `Backticks` show code names in the code font, as in the rest of the docs. */
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  /** Labelled lines, such as a decision's "Why" and "Trade-off". */
  | { kind: 'fields'; fields: { label: string; text: string }[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  /**
   * Exact text from a file in the repo (code or config), shown as code. The checker fails the
   * build when the text is no longer in the file, so a quote can't go stale.
   */
  | { kind: 'quote'; file: string; text: string; caption?: string }
  /** The tech stack's package table, built from every app's package.json. */
  | { kind: 'packages' };

export interface DocSection {
  /** Unique within its page; links to the section use it. */
  id: string;
  title: string;
  status: Status;
  /** The roadmap feature that adds it, when it is planned. */
  plannedIn?: string;
  blocks: DocBlock[];
  /** The parts, flows, functions and files this section is about, shown as "In the map". */
  refs?: DocRef[];
}

export interface DocPage {
  /** Used in its URL. */
  id: string;
  title: string;
  /** One line, shown under the title and in search. */
  summary: string;
  /**
   * For a page shown at the top of a sidebar section instead of on its own under Docs: the
   * error-handling page opens the Error Handling section, above its flows.
   */
  section?: 'errors';
  sections: DocSection[];
}

/**
 * The Error Handling section lists its flows under this id, after the error-handling page's own
 * sections, so that page can't use it for a section of its own (the checker makes sure).
 */
export const ERROR_FLOWS_SECTION_ID = 'error-flows';

/** Where a package or tool sits in the stack. The tech stack page groups by it. */
export type StackLayer =
  'frontend' | 'backend' | 'data' | 'ai' | 'payments' | 'quality' | 'tooling';

/** Why the project uses an npm package. Its versions come from the package.json files. */
export interface PackageNote {
  /** The package name as written in package.json, e.g. `pino`. */
  name: string;
  layer: StackLayer;
  /** One line: what it does in this project. */
  why: string;
}

/** A tool or service the roadmap adds that the code doesn't use yet. */
export interface PlannedTool {
  name: string;
  /** Its npm package, when it is one. The checker flags it once a package.json lists it. */
  package?: string;
  layer: StackLayer;
  why: string;
  plannedIn: string;
}

/** Everything hand-written for the docs pages, as the explorer and the checker read it. */
export interface GuidesData {
  pages: DocPage[];
  packageNotes: PackageNote[];
  plannedTools: PlannedTool[];
}

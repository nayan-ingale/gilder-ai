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
    description: 'Built and tested, but no route or flow uses it yet.',
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

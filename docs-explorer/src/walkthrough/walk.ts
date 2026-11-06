import type { EdgeKind, Flow } from '../data/schema.ts';

/**
 * The walkthrough: a reader steps through one flow like a debugger, one step at a time. A walk
 * is the list of steps visited so far (the trail); the last one is where the reader is, and
 * Previous drops it. Everything here is worked out from the flow's lines alone, so it is pure
 * and tested against the real flows. Nothing is run: the walk only follows what the docs say
 * the code does.
 *
 * The rules:
 * - one onward line is the next move; several (conditions, error paths) are a choice;
 * - an async line is work that finishes later. Beside a line that goes on straight away it is
 *   a side event ("also, later"), not a choice; on its own it is the next move, marked later;
 * - parallel lines start parts of work that run at the same time, and the fork step names
 *   where they all meet (its `join`). The walk follows part 1's own path until it would reach
 *   the join, then part 2's, and so on; steps the parts share are visited once per part. After
 *   the last part, the walk goes on at the join;
 * - no onward line and nothing waiting is the end of the path.
 * Steps can appear in a trail more than once (shared steps of parallel parts).
 */

/** A line out of a step: its own `next` lines, or the implied one to the next step in the list. */
interface Line {
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
}

/** One part of parallel work: the step it starts at, and its line's label. */
export interface ParallelPart {
  step: string;
  label?: string;
}

/** Parallel work in progress. */
export interface ParallelWork {
  /** The step that starts the work. */
  fork: string;
  /** The parts that run at the same time, in list order. */
  parts: ParallelPart[];
  /** The part being walked, from 0. */
  index: number;
  /** Where every part is done and the flow goes on (the fork step's `join`). */
  join?: string;
}

/** Parallel work that a move starts, moves through or ends. */
export interface ParallelInfo extends ParallelWork {
  /**
   * `start` opens the first part; `part` starts the next part (`index`); `join` goes on at the
   * join once every part is done.
   */
  role: 'start' | 'part' | 'join';
  /** For `part`: the previous part reached the join (rather than coming to an end). */
  reachedJoin?: boolean;
}

/** One way forward from the current step. */
export interface WalkMove {
  /** The step it goes to. */
  to: string;
  /** The kind of line taken. Starting the next part of parallel work says `parallel`. */
  kind: EdgeKind;
  /** The line's condition or reason, e.g. "every check is ok". */
  label?: string;
  /** The step runs later (an async line), not straight after this one. */
  later: boolean;
  parallel?: ParallelInfo;
}

/**
 * What the reader can do next: one move, a choice between several, or nothing more. `later`
 * lists async work that happens beside the move or the choice; the reader can jump to it.
 */
export type WalkNext =
  | { type: 'move'; move: WalkMove; later: WalkMove[] }
  | { type: 'choice'; options: WalkMove[]; later: WalkMove[] }
  | { type: 'end' };

/** Where the reader is on the path. */
export interface WalkPosition {
  /** 1-based. */
  number: number;
  /** Steps on the path: the ones walked, then the rest taking the first choice at each split. */
  total: number;
  /** A choice lies ahead, so `total` depends on it. */
  choicesAhead: boolean;
}

// ---------------------------------------------------------------------------------------------
// The flow as a graph, built once per flow.

interface ParallelGroup {
  fork: string;
  parts: ParallelPart[];
  /** The part being walked now. */
  at: number;
  join?: string;
}

interface WalkState {
  current: string;
  /** Open parallel work, outermost first. */
  groups: ParallelGroup[];
}

interface Transition {
  move: WalkMove;
  /** Async work beside the main way on: offered as "also, later", not as a choice. */
  side: boolean;
  /** The flow lines this move stands for, drawn as the walked path. */
  lines: Line[];
  state: WalkState;
}

interface WalkGraph {
  flow: Flow;
  start?: string;
  ids: Set<string>;
  out: Map<string, Line[]>;
  joins: Map<string, string>;
  /** No walk needs more moves than this; a guard against flows with loops. */
  longest: number;
}

const graphs = new WeakMap<Flow, WalkGraph>();

function graphOf(flow: Flow): WalkGraph {
  const cached = graphs.get(flow);
  if (cached) return cached;
  const ids = new Set(flow.steps.map((step) => step.id));
  // The same rule as docs.flowLines (walk.test.ts checks they match). Lines to a step that
  // isn't in the flow are left out, as the graph leaves them out.
  const out = new Map(
    flow.steps.map((step, index) => {
      const following = flow.steps[index + 1];
      const edges = step.next ?? (following ? [{ to: following.id, kind: 'next' as const }] : []);
      const lines = edges
        .filter((edge) => ids.has(edge.to))
        .map((edge): Line => ({ from: step.id, ...edge }));
      return [step.id, lines];
    }),
  );
  const joins = new Map(
    flow.steps.flatMap((step) =>
      step.join !== undefined && ids.has(step.join) ? [[step.id, step.join] as const] : [],
    ),
  );
  // Each part can walk the shared steps again, so allow a full pass per parallel line.
  const parallelLines = [...out.values()].flat().filter((line) => line.kind === 'parallel');
  const longest = flow.steps.length * (2 + parallelLines.length);
  const graph: WalkGraph = { flow, start: flow.steps[0]?.id, ids, out, joins, longest };
  graphs.set(flow, graph);
  return graph;
}

const work = (group: ParallelGroup): ParallelWork => ({
  fork: group.fork,
  parts: group.parts,
  index: group.at,
  join: group.join,
});

const hasWaitingPart = (group: ParallelGroup): boolean => group.at + 1 < group.parts.length;

/** Start the next part of the parallel work at `depth`, closing any work inside it. */
function nextPart(
  graph: WalkGraph,
  state: WalkState,
  depth: number,
  lines: Line[],
): Transition | undefined {
  const group = state.groups[depth];
  const part = group?.parts[group.at + 1];
  if (!group || !part) return undefined;
  const forkLine = graph.out.get(group.fork)?.find((line) => line.to === part.step);
  const moved = { ...group, at: group.at + 1 };
  return {
    move: {
      to: part.step,
      kind: 'parallel',
      label: part.label,
      later: false,
      parallel: { ...work(moved), role: 'part', reachedJoin: lines.length > 0 },
    },
    side: false,
    lines: forkLine ? [...lines, forkLine] : lines,
    state: { current: part.step, groups: [...state.groups.slice(0, depth), moved] },
  };
}

/** Follow one line. A line to the join of open parallel work starts its next part instead. */
function follow(graph: WalkGraph, state: WalkState, line: Line, side: boolean): Transition {
  const move: WalkMove = {
    to: line.to,
    kind: line.kind,
    label: line.label,
    later: line.kind === 'async',
  };
  for (let depth = state.groups.length - 1; depth >= 0; depth -= 1) {
    const group = state.groups[depth];
    if (!group || group.join !== line.to) continue;
    const waiting = hasWaitingPart(group) ? nextPart(graph, state, depth, [line]) : undefined;
    if (waiting) return waiting;
    return {
      move: { ...move, parallel: { ...work(group), role: 'join' } },
      side,
      lines: [line],
      state: { current: line.to, groups: state.groups.slice(0, depth) },
    };
  }
  return { move, side, lines: [line], state: { current: line.to, groups: state.groups } };
}

/** Every move from a state, each with the state it leads to. Each step appears once. */
function transitions(graph: WalkGraph, state: WalkState): Transition[] {
  const lines = graph.out.get(state.current) ?? [];
  const [first] = lines;

  // Work that runs at the same time: start its first part; the others follow in turn.
  if (first && lines.length > 1 && lines.every((line) => line.kind === 'parallel')) {
    const parts = [...new Map(lines.map((line) => [line.to, line.label])).entries()].map(
      ([step, label]): ParallelPart => ({ step, label }),
    );
    const group: ParallelGroup = {
      fork: state.current,
      parts,
      at: 0,
      join: graph.joins.get(state.current),
    };
    return [
      {
        move: {
          to: first.to,
          kind: 'parallel',
          label: first.label,
          later: false,
          parallel: { ...work(group), role: 'start' },
        },
        side: false,
        lines: [first],
        state: { current: first.to, groups: [...state.groups, group] },
      },
    ];
  }

  if (lines.length === 0) {
    // The end of a part's own path: the next part of parallel work, if one waits.
    const depth = state.groups.findLastIndex(hasWaitingPart);
    const waiting = depth === -1 ? undefined : nextPart(graph, state, depth, []);
    return waiting ? [waiting] : [];
  }

  // Async work beside a line that goes on straight away happens later, on the side.
  const main = lines.filter((line) => line.kind !== 'async');
  const later = lines.filter((line) => line.kind === 'async');
  const followed = [
    ...(main.length > 0 ? main : later).map((line) => follow(graph, state, line, false)),
    ...(main.length > 0 ? later : []).map((line) => follow(graph, state, line, true)),
  ];
  const seen = new Set<string>();
  return followed.filter(({ move }) => {
    if (seen.has(move.to)) return false;
    seen.add(move.to);
    return true;
  });
}

const stateKey = ({ current, groups }: WalkState): string =>
  `${current}|${groups.map((group) => `${group.fork}@${group.at}`).join('/')}`;

/** Replays `ids` from the start of the flow, as far as each one is a legal move. */
function replay(
  graph: WalkGraph,
  ids: string[],
): { trail: string[]; state?: WalkState; taken: Transition[]; complete: boolean } {
  const [first, ...rest] = ids;
  if (first === undefined) return { trail: [], taken: [], complete: true };
  if (first !== graph.start) return { trail: [], taken: [], complete: false };
  let state: WalkState = { current: first, groups: [] };
  const trail = [first];
  const taken: Transition[] = [];
  for (const id of rest) {
    const transition = transitions(graph, state).find(({ move }) => move.to === id);
    if (!transition) return { trail, state, taken, complete: false };
    trail.push(id);
    taken.push(transition);
    state = transition.state;
  }
  return { trail, state, taken, complete: true };
}

/** The fewest moves from the start of the flow to `target`, or undefined if none reach it. */
function shortestTrail(graph: WalkGraph, target: string): string[] | undefined {
  if (graph.start === undefined) return undefined;
  const start: WalkState = { current: graph.start, groups: [] };
  const seen = new Set([stateKey(start)]);
  const queue = [{ state: start, trail: [graph.start] }];
  for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
    if (item.state.current === target) return item.trail;
    if (item.trail.length >= graph.longest) continue;
    for (const { move, state } of transitions(graph, item.state)) {
      const key = stateKey(state);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state, trail: [...item.trail, move.to] });
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// The walk, as the panel and the graph use it.

/** A walk that has just started: the first step of the flow. */
export function startTrail(flow: Flow): string[] {
  const first = flow.steps[0];
  return first ? [first.id] : [];
}

/** The moves from the last step of `trail` (a trail from parseTrail). */
export function nextMoves(flow: Flow, trail: string[]): WalkNext {
  const graph = graphOf(flow);
  const { state } = replay(graph, trail);
  const all = state ? transitions(graph, state) : [];
  const main = all.filter(({ side }) => !side).map(({ move }) => move);
  const later = all.filter(({ side }) => side).map(({ move }) => move);
  const [only] = main;
  if (!only) return { type: 'end' };
  return main.length === 1
    ? { type: 'move', move: only, later }
    : { type: 'choice', options: main, later };
}

/** The move that led to the last step of `trail`; undefined at the start. */
export function arrivedBy(flow: Flow, trail: string[]): WalkMove | undefined {
  return replay(graphOf(flow), trail).taken.at(-1)?.move;
}

/** The parallel work the last step of `trail` is part of, if any (the innermost). */
export function openParallel(flow: Flow, trail: string[]): ParallelWork | undefined {
  const group = replay(graphOf(flow), trail).state?.groups.at(-1);
  return group ? work(group) : undefined;
}

/** Where the last step of `trail` sits on the path, and how long the path is. */
export function walkPosition(flow: Flow, trail: string[]): WalkPosition {
  const graph = graphOf(flow);
  let { state } = replay(graph, trail);
  let ahead = 0;
  let choicesAhead = false;
  while (state && trail.length + ahead < graph.longest) {
    const main = transitions(graph, state).filter(({ side }) => !side);
    if (main.length > 1) choicesAhead = true;
    state = main[0]?.state;
    if (state) ahead += 1;
  }
  return { number: trail.length, total: trail.length + ahead, choicesAhead };
}

/** A key for a line between two steps, as `walkedLines` lists them. */
export function walkLineKey(from: string, to: string): string {
  return `${from}>${to}`;
}

/**
 * The flow lines the walk has followed so far, as `walkLineKey`s: each line from one visited
 * step to the next, plus, for parallel work, the line from the fork to each part and the line
 * on which a part reached the join.
 */
export function walkedLines(flow: Flow, trail: string[]): Set<string> {
  const { taken } = replay(graphOf(flow), trail);
  return new Set(
    taken.flatMap(({ lines }) => lines.map((line) => walkLineKey(line.from, line.to))),
  );
}

/**
 * Rebuilds a trail from the URL (`?walk=a,b,c`, see routes.ts). Unknown step ids are dropped,
 * and the rest is kept only if every step is a legal move from the one before, starting at the
 * first step of the flow. If it isn't, or it doesn't end at the requested `step`, the walk
 * takes the fewest moves to `step` instead. With no usable step, it keeps the legal start of
 * the trail, or starts over.
 */
export function parseTrail(flow: Flow, raw: string | undefined, step?: string): string[] {
  const graph = graphOf(flow);
  const ids = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => graph.ids.has(id));
  const { trail, complete } = replay(graph, ids);
  const target = step !== undefined && graph.ids.has(step) ? step : undefined;
  if (complete && trail.length > 0 && (target === undefined || trail.at(-1) === target)) {
    return trail;
  }
  const repaired = target === undefined ? undefined : shortestTrail(graph, target);
  if (repaired) return repaired;
  return trail.length > 0 ? trail : startTrail(flow);
}

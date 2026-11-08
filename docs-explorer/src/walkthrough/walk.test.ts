// The walkthrough rules, checked on every real flow: walks end, every step can be reached,
// parallel work is walked part by part (shared steps once per part), async work is a side
// event, Previous undoes a move exactly, and a forged or broken trail in the URL is repaired.
import { describe, expect, it } from 'vitest';
import type { Flow } from '../data/schema.ts';
import { docs } from '../model/index.ts';
import {
  arrivedBy,
  nextMoves,
  openParallel,
  parseTrail,
  startTrail,
  walkLineKey,
  walkPosition,
  walkedLines,
  type ParallelInfo,
  type WalkMove,
} from './walk.ts';

function flow(id: string): Flow {
  const found = docs.getFlow(id);
  if (!found) throw new Error(`No flow ${id}`);
  return found;
}

/** Every legal move: the way on (or the options of a split) and any async side work. */
const movesOf = (flow: Flow, trail: string[]): WalkMove[] => {
  const next = nextMoves(flow, trail);
  if (next.type === 'end') return [];
  return [...(next.type === 'move' ? [next.move] : next.options), ...next.later];
};

/** Every complete path through a flow, taking every option at every choice. */
function allPaths(flow: Flow): { trail: string[]; moves: WalkMove[] }[] {
  const paths: { trail: string[]; moves: WalkMove[] }[] = [];
  const longest = flow.steps.length * 6;
  const visit = (trail: string[], moves: WalkMove[]) => {
    if (trail.length > longest) throw new Error(`${flow.id}: a walk never ends`);
    const options = movesOf(flow, trail);
    if (options.length === 0) paths.push({ trail, moves });
    for (const move of options) visit([...trail, move.to], [...moves, move]);
  };
  visit(startTrail(flow), []);
  return paths;
}

/** Takes the way on, or the first option at every split, until the path ends. */
function firstChoicePath(flow: Flow): string[] {
  let trail = startTrail(flow);
  for (let moves = 0; moves <= flow.steps.length * 6; moves += 1) {
    const next = nextMoves(flow, trail);
    if (next.type === 'end') return trail;
    const move = next.type === 'move' ? next.move : next.options[0];
    if (!move) return trail;
    trail = [...trail, move.to];
  }
  throw new Error(`${flow.id}: the first-choice walk never ends`);
}

const each = docs.flows.map((flow) => [flow.id, flow] as const);

describe('walking the real flows', () => {
  it('covers all twenty-three flows', () => {
    expect(docs.flows).toHaveLength(23);
  });

  it.each(each)('%s: taking the first option ends after a finite number of moves', (_id, f) => {
    const trail = firstChoicePath(f);
    expect(trail[0]).toBe(f.steps[0]?.id);
    expect(nextMoves(f, trail)).toEqual({ type: 'end' });
    expect(walkPosition(f, startTrail(f)).total).toBe(trail.length);
  });

  it.each(each)('%s: every step can be reached through some choices', (_id, f) => {
    const reached = new Set(allPaths(f).flatMap(({ trail }) => trail));
    expect([...reached].sort()).toEqual(f.steps.map((step) => step.id).sort());
  });

  it.each(each)('%s: moves only along lines, or to the next part of parallel work', (_id, f) => {
    const lines = new Set(docs.flowLines(f).map((line) => walkLineKey(line.from, line.to)));
    for (const { trail, moves } of allPaths(f)) {
      moves.forEach((move, index) => {
        const from = trail[index] ?? '';
        if (move.parallel?.role === 'part') expect(move.kind).toBe('parallel');
        else expect(lines.has(walkLineKey(from, move.to))).toBe(true);
      });
      for (const key of walkedLines(f, trail)) expect(lines.has(key)).toBe(true);
    }
  });

  it.each(each)('%s: walks each part of parallel work before its join', (_id, f) => {
    for (const { trail, moves } of allPaths(f)) {
      const started = moves
        .map((move) => move.parallel)
        .filter((parallel): parallel is ParallelInfo => parallel?.role === 'start');
      for (const { fork, parts, join } of started) {
        const forkAt = trail.indexOf(fork);
        const partAt = parts.map((part) => trail.indexOf(part.step, forkAt));
        expect(partAt.every((at) => at > forkAt)).toBe(true);
        expect(partAt).toEqual([...partAt].sort((a, b) => a - b));
        expect(join).toBeDefined();
        if (join !== undefined && trail.includes(join)) {
          expect(trail.indexOf(join, forkAt)).toBeGreaterThan(Math.max(...partAt));
        }
      }
    }
  });

  it.each(each)('%s: Previous after any move gives back the same trail and moves', (_id, f) => {
    for (const { trail } of allPaths(f)) {
      for (let length = 1; length < trail.length; length += 1) {
        const before = trail.slice(0, length);
        const next = nextMoves(f, before);
        for (const option of movesOf(f, before)) {
          const after = [...before, option.to];
          expect(parseTrail(f, after.join(','), option.to)).toEqual(after);
          expect(arrivedBy(f, after)).toEqual(option);
          expect(after.slice(0, -1)).toEqual(before);
          expect(nextMoves(f, after.slice(0, -1))).toEqual(next);
        }
      }
    }
  });
});

describe('the readiness check', () => {
  const readiness = flow('readiness-check');
  const toFork = [
    'caller',
    'request-id',
    'request-logger',
    'security-headers',
    'json-body',
    'health-router',
    'readyz-handler',
    'run-checks',
  ];

  it("walks each check's own path in turn, then meets at the decision", () => {
    expect(firstChoicePath(readiness)).toEqual([
      ...toFork,
      'ping-mongo',
      'with-timeout',
      'record-ok',
      'ping-redis',
      'with-timeout',
      'record-ok',
      'decide',
      'response-ready',
    ]);
  });

  it('starts the checks at the fork, with their labels and the join from the data', () => {
    expect(parseTrail(readiness, undefined, 'run-checks')).toEqual(toFork);
    expect(nextMoves(readiness, toFork)).toEqual({
      type: 'move',
      later: [],
      move: {
        to: 'ping-mongo',
        kind: 'parallel',
        label: 'mongo check (auth, chat, agent, billing)',
        later: false,
        parallel: {
          role: 'start',
          fork: 'run-checks',
          parts: [
            { step: 'ping-mongo', label: 'mongo check (auth, chat, agent, billing)' },
            { step: 'ping-redis', label: 'redis check (gateway, auth, agent)' },
          ],
          index: 0,
          join: 'decide',
        },
      },
    });
  });

  it('follows the first check to its timer, and its own result, before the second check', () => {
    const atMongo = [...toFork, 'ping-mongo'];
    expect(nextMoves(readiness, atMongo)).toMatchObject({
      type: 'move',
      move: { to: 'with-timeout', kind: 'next', label: 'raced against the timer' },
    });
    const atTimer = [...atMongo, 'with-timeout'];
    expect(openParallel(readiness, atTimer)).toMatchObject({ fork: 'run-checks', index: 0 });
    const choice = nextMoves(readiness, atTimer);
    expect(choice).toMatchObject({
      type: 'choice',
      options: [
        { to: 'record-ok', kind: 'branch', label: 'the check resolved in time' },
        { to: 'record-failed', kind: 'error', label: 'the check threw or took longer than 2 s' },
      ],
    });

    // The first result would reach the decision, which waits for every check: the second
    // check starts instead.
    const failed = [...atTimer, 'record-failed'];
    expect(nextMoves(readiness, failed)).toMatchObject({
      type: 'move',
      move: {
        to: 'ping-redis',
        kind: 'parallel',
        label: 'redis check (gateway, auth, agent)',
        parallel: { role: 'part', index: 1, reachedJoin: true, join: 'decide' },
      },
    });
  });

  it('visits the shared steps again for the second check, then goes on at the join', () => {
    const second = [...toFork, 'ping-mongo', 'with-timeout', 'record-ok', 'ping-redis'];
    expect(openParallel(readiness, second)).toMatchObject({ index: 1 });
    const atTimer = [...second, 'with-timeout'];
    expect(parseTrail(readiness, atTimer.join(','), 'with-timeout')).toEqual(atTimer);
    expect(walkPosition(readiness, atTimer).number).toBe(atTimer.length);

    const done = [...atTimer, 'record-failed'];
    expect(nextMoves(readiness, done)).toMatchObject({
      type: 'move',
      move: { to: 'decide', kind: 'next', parallel: { role: 'join', fork: 'run-checks' } },
    });
    const atDecide = [...done, 'decide'];
    expect(openParallel(readiness, atDecide)).toBeUndefined();
    expect(nextMoves(readiness, atDecide).type).toBe('choice');

    // Previous from the second visit to the timer goes back to the second check.
    expect(parseTrail(readiness, second.join(','), 'ping-redis')).toEqual(second);
  });

  it('draws the lines both checks took', () => {
    const atDecide = [
      ...toFork,
      'ping-mongo',
      'with-timeout',
      'record-ok',
      'ping-redis',
      'with-timeout',
      'record-failed',
      'decide',
    ];
    const lines = walkedLines(readiness, atDecide);
    for (const [from, to] of [
      ['run-checks', 'ping-mongo'],
      ['run-checks', 'ping-redis'],
      ['ping-mongo', 'with-timeout'],
      ['ping-redis', 'with-timeout'],
      ['with-timeout', 'record-ok'],
      ['with-timeout', 'record-failed'],
      ['record-ok', 'decide'],
      ['record-failed', 'decide'],
    ] as const) {
      expect(lines).toContain(walkLineKey(from, to));
    }
  });

  it('ends at either response', () => {
    const ends = allPaths(readiness).map(({ trail }) => trail.at(-1));
    expect(new Set(ends)).toEqual(new Set(['response-ready', 'response-not-ready']));
  });
});

describe('the error handling flow', () => {
  const errors = flow('error-handling');

  it('offers each labelled way out of a decision', () => {
    const atParser = parseTrail(errors, 'request,body-parser', 'body-parser');
    expect(atParser).toEqual(['request', 'body-parser']);
    expect(nextMoves(errors, atParser)).toMatchObject({
      type: 'choice',
      later: [],
      options: [
        { to: 'routes', kind: 'next', label: 'the body is fine, or there is none' },
        { to: 'error-handler', kind: 'error', label: 'next(err): the body was rejected' },
      ],
    });

    const atSort = parseTrail(errors, undefined, 'to-app-error');
    const sorted = nextMoves(errors, atSort);
    expect(sorted.type === 'choice' ? sorted.options.map((option) => option.to) : []).toEqual([
      'keep',
      'too-large',
      'bad-json',
      'unsupported',
      'internal',
    ]);
  });

  it('ends where the docs end a path', () => {
    const passOn = parseTrail(errors, undefined, 'pass-on');
    expect(nextMoves(errors, passOn)).toEqual({ type: 'end' });
  });
});

describe('work that finishes later', () => {
  it('is the next move, marked later, when it is the only way on', () => {
    const unknown = flow('unknown-route');
    const atResponse = parseTrail(unknown, undefined, 'response');
    expect(nextMoves(unknown, atResponse)).toMatchObject({
      type: 'move',
      move: { to: 'access-log', kind: 'async', later: true },
      later: [],
    });
  });

  it('is a side event, not a choice, when the path also goes on straight away', () => {
    const startup = flow('app-startup');
    const atRedis = parseTrail(startup, undefined, 'redis');
    expect(nextMoves(startup, atRedis)).toEqual({
      type: 'move',
      move: { to: 'app', kind: 'next', later: false },
      later: [
        { to: 'redis-errors', kind: 'async', label: 'Redis is down, or drops later', later: true },
      ],
    });
    // The side event can still be opened, and Previous comes back to the same place.
    const jumped = [...atRedis, 'redis-errors'];
    expect(parseTrail(startup, jumped.join(','), 'redis-errors')).toEqual(jumped);
    expect(nextMoves(startup, jumped)).toEqual({ type: 'end' });
    expect(walkPosition(startup, atRedis).total).toBe(firstChoicePath(startup).length);
  });
});

describe('walkPosition', () => {
  it('counts every step on a path without choices', () => {
    const health = flow('health-check');
    const trail = parseTrail(health, undefined, 'health-router');
    expect(walkPosition(health, trail)).toEqual({
      number: trail.length,
      total: health.steps.length,
      choicesAhead: false,
    });
  });

  it('says when the count depends on a choice ahead', () => {
    const readiness = flow('readiness-check');
    expect(walkPosition(readiness, startTrail(readiness))).toEqual({
      number: 1,
      total: 16,
      choicesAhead: true,
    });
    const done = parseTrail(readiness, undefined, 'response-ready');
    expect(walkPosition(readiness, done)).toEqual({
      number: done.length,
      total: done.length,
      choicesAhead: false,
    });
  });
});

describe('parseTrail', () => {
  const readiness = flow('readiness-check');
  const legal = (trail: string[]) => parseTrail(readiness, trail.join(','), trail.at(-1));

  it('starts at the first step with nothing to go on', () => {
    expect(parseTrail(readiness, undefined)).toEqual(['caller']);
    expect(parseTrail(readiness, '')).toEqual(['caller']);
    expect(startTrail(readiness)).toEqual(['caller']);
  });

  it('keeps a legal trail as it is, repeated steps included', () => {
    const trail = firstChoicePath(readiness);
    expect(trail.filter((id) => id === 'with-timeout')).toHaveLength(2);
    expect(legal(trail)).toEqual(trail);
    expect(parseTrail(readiness, trail.join(','))).toEqual(trail);
  });

  it('drops unknown step ids', () => {
    expect(parseTrail(readiness, 'caller,nope,request-id', 'request-id')).toEqual([
      'caller',
      'request-id',
    ]);
  });

  it('repairs a trail that jumps ahead to the shortest legal one', () => {
    const repaired = parseTrail(readiness, 'caller,decide', 'decide');
    expect(repaired[0]).toBe('caller');
    expect(repaired.at(-1)).toBe('decide');
    expect(legal(repaired)).toEqual(repaired);
    // Both checks are walked on the way, each through the timer and the shorter "ok" result.
    expect(repaired.filter((id) => id === 'with-timeout')).toHaveLength(2);
    expect(repaired).toEqual(expect.arrayContaining(['ping-mongo', 'ping-redis', 'record-ok']));
    expect(repaired).not.toContain('record-failed');
  });

  it('repairs a trail that skips a part of parallel work', () => {
    const toFork = parseTrail(readiness, undefined, 'run-checks');
    const forged = [...toFork, 'ping-mongo', 'with-timeout', 'record-ok', 'decide'];
    const repaired = parseTrail(readiness, forged.join(','), 'decide');
    expect(repaired).toEqual([
      ...toFork,
      'ping-mongo',
      'with-timeout',
      'record-ok',
      'ping-redis',
      'with-timeout',
      'record-ok',
      'decide',
    ]);
  });

  it('repairs a trail that does not start at the first step', () => {
    const repaired = parseTrail(readiness, 'request-id,request-logger', 'request-logger');
    expect(repaired).toEqual(['caller', 'request-id', 'request-logger']);
  });

  it('follows the requested step when the trail ends somewhere else', () => {
    expect(parseTrail(readiness, 'caller,request-id', 'caller')).toEqual(['caller']);
  });

  it('keeps the legal start of a broken trail when the step is unknown', () => {
    expect(parseTrail(readiness, 'caller,request-id,decide', 'nowhere')).toEqual([
      'caller',
      'request-id',
    ]);
  });
});

describe('the walked lines', () => {
  it('match the lines the graph draws', () => {
    // walk.ts reads the lines itself; it must agree with docs.flowLines, which the graph uses.
    for (const f of docs.flows) {
      const fromModel = new Set(docs.flowLines(f).map((line) => walkLineKey(line.from, line.to)));
      for (const { trail } of allPaths(f)) {
        for (const key of walkedLines(f, trail)) expect(fromModel.has(key)).toBe(true);
      }
    }
  });
});

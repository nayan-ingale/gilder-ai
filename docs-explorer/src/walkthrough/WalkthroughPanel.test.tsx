// Renders the walkthrough panel on every step of every real flow, reached the shortest way,
// so a missing field or a broken wording shows up as a failing test. Rendered to static HTML:
// effects (focus, keys, loading source code) don't run, which is fine for checking the content.
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Flow } from '../data/schema.ts';
import { docs } from '../model/index.ts';
import { parseTrail, walkPosition } from './walk.ts';
import { WalkthroughPanel } from './WalkthroughPanel.tsx';

function render(flow: Flow, trail: string[]): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/flows/${flow.id}`]}>
      <WalkthroughPanel
        flow={flow}
        trail={trail}
        position={walkPosition(flow, trail)}
        trailRef={{ current: trail }}
        onMove={() => undefined}
        onExit={() => undefined}
        focusRef={{ current: null }}
      />
    </MemoryRouter>,
  );
}

/** The visible text: tags dropped, and the escapes React adds to static HTML undone. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ');
}

function flow(id: string): Flow {
  const found = docs.getFlow(id);
  if (!found) throw new Error(`No flow ${id}`);
  return found;
}

const SECTIONS = [
  'Function at this step',
  'What happens inside',
  'Input and output',
  'What comes next',
];

const NEXT_OFF = /data-walk-control="next"[^>]*disabled=""/;

describe('WalkthroughPanel', () => {
  const cases = docs.flows.flatMap((f) =>
    f.steps.map((step) => [`${f.id} › ${step.id}`, f, step.id] as const),
  );

  it.each(cases)('renders %s', (_name, f, stepId) => {
    const trail = parseTrail(f, undefined, stepId);
    const position = walkPosition(f, trail);
    const html = text(render(f, trail));
    expect(html).toContain(`Step ${position.number} of ${position.total} on this path`);
    expect(html).toContain(
      'This follows the documented flow through the source code, step by step. Nothing is sent or run.',
    );
    let last = -1;
    for (const section of SECTIONS) {
      const at = html.indexOf(section);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it('offers each option of a split as a button, and turns Next off', () => {
    const errors = flow('error-handling');
    const html = render(errors, parseTrail(errors, undefined, 'to-app-error'));
    expect(html).toMatch(NEXT_OFF);
    expect(text(html)).toContain('Pick a path below');
    expect(text(html)).toContain('The path splits after “toAppError sorts the error”.');
    for (const label of ['already an AppError', "type 'entity.too.large'", 'anything else']) {
      expect(text(html)).toContain(label);
    }
  });

  it('names the parts of parallel work with their labels, and where they meet', () => {
    const readiness = flow('readiness-check');
    const atFork = text(render(readiness, parseTrail(readiness, undefined, 'run-checks')));
    expect(atFork).toContain(
      '“Run every check at once, each with a time limit” starts work that runs at the same time: “mongo check (auth, chat, agent, billing)” and “redis check (gateway, auth, agent)”.',
    );
    expect(atFork).toContain(
      'They meet at “Ready only if every check is ok” once every part is done.',
    );
    expect(atFork).not.toMatch(/\b2 pieces\b/);
  });

  it('says which part a shared step belongs to, and starts the next part at the join', () => {
    const readiness = flow('readiness-check');
    const toFork = parseTrail(readiness, undefined, 'run-checks');
    const firstTimer = [...toFork, 'ping-mongo', 'with-timeout'];
    expect(text(render(readiness, firstTimer))).toContain(
      'Part 1 of 2 in this walkthrough: “mongo check (auth, chat, agent, billing)”.',
    );

    const firstOk = text(render(readiness, [...firstTimer, 'record-ok']));
    expect(firstOk).toContain(
      '“Mark the check ok” leads on to “Ready only if every check is ok”, which waits until every part is done. So the walkthrough starts part 2 of 2: “redis check (gateway, auth, agent)”.',
    );

    const secondTimer = [...firstTimer, 'record-ok', 'ping-redis', 'with-timeout'];
    expect(text(render(readiness, secondTimer))).toContain(
      'Part 2 of 2 in this walkthrough: “redis check (gateway, auth, agent)”.',
    );

    const atDecide = text(render(readiness, [...secondTimer, 'record-ok', 'decide']));
    expect(atDecide).toContain(
      'Every part started by “Run every check at once, each with a time limit” has finished, so the flow goes on at “Ready only if every check is ok”.',
    );
    expect(atDecide).not.toContain('in this walkthrough:');
  });

  it('shows async work beside the way on as "also, later", with Next still on', () => {
    const startup = flow('app-startup');
    const html = render(startup, parseTrail(startup, undefined, 'redis'));
    expect(html).not.toMatch(NEXT_OFF);
    expect(text(html)).not.toContain('The path splits');
    expect(text(html)).toContain(
      'Also, later: “Redis down: the app runs, /readyz says 503” — Redis is down, or drops later',
    );
  });

  it('ends a path, and starts with Previous turned off', () => {
    const readiness = flow('readiness-check');
    const done = render(readiness, parseTrail(readiness, undefined, 'response-ready'));
    expect(text(done)).toContain('End of this path');
    expect(text(done)).toContain('Nothing follows “200 ready” in the docs.');
    expect(done).toMatch(NEXT_OFF);

    const health = flow('health-check');
    const html = render(health, ['caller']);
    expect(html).toMatch(/data-walk-control="previous"[^>]*disabled=""/);
    expect(text(html)).toContain('This step is outside our code');
  });
});

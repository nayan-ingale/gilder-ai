// Renders every detail view against the real docs and code index, so a missing field or a bad
// reference in the data shows up as a failing test, not a blank panel. Rendered to static HTML:
// effects (like loading source code) don't run, which is fine for checking the content.
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ARCH_VIEWS, architectureView } from '../model/architecture-views.ts';
import type { StepNeighbour } from '../model/docs-model.ts';
import { docs } from '../model/index.ts';
import { ComponentDetails } from './ComponentDetails.tsx';
import { fileLocation } from './format.ts';
import { StepDetails } from './StepDetails.tsx';
import { SymbolDetails } from './SymbolDetails.tsx';

/** Renders on `url` inside the app's own route patterns, so the views can read `useParams()`. */
function render(element: ReactElement, url = '/flows/health-check'): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/architecture/:viewId" element={element} />
        <Route path="/flows/:flowId" element={element} />
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A page address with a selection in its query, encoded the way the app writes it. */
function url(path: string, query: Record<string, string>): string {
  return `${path}?${new URLSearchParams(query).toString()}`;
}

/** The visible text: tags dropped, and the escapes React adds to static HTML undone. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/** Every link in the HTML: where it goes and its text. */
function links(html: string): { href: string; text: string }[] {
  return [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)].map((match) => ({
    href: text(/href="([^"]*)"/.exec(match[1] ?? '')?.[1] ?? ''),
    text: text(match[2] ?? ''),
  }));
}

/** The two boxes at the foot of a step view: each a button that opens a step, or a note. */
function stepNav(html: string): { button: boolean; text: string }[] {
  const nav = /<nav aria-label="Walk through the flow"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? '';
  return [...nav.matchAll(/<(button|div)\b[^>]*>(.*?)<\/\1>/gs)].map((match) => ({
    button: match[1] === 'button',
    text: text(match[2] ?? ''),
  }));
}

function renderStep(flowId: string, stepId: string): string {
  return render(<StepDetails flowId={flowId} stepId={stepId} />, `/flows/${flowId}`);
}

const SYSTEM_HINT = '(in System Architecture)';

describe('ComponentDetails', () => {
  it.each(docs.components.map((component) => [component.id]))('renders %s', (id) => {
    const html = text(render(<ComponentDetails componentId={id} />, '/architecture/system'));
    const component = docs.getComponent(id);
    expect(html).toContain(component?.name);
    expect(html).toContain(component?.summary.replaceAll('`', ''));
  });

  it('lists connections both ways, with links that select the other node', () => {
    const html = render(<ComponentDetails componentId="shared" />, '/architecture/system');
    expect(html).toContain('Incoming');
    expect(html).toContain('href="/architecture/system?node=gateway"');
    expect(html).not.toContain(SYSTEM_HINT);
  });

  it('sends a connection the open view does not show to System Architecture', () => {
    const html = render(
      <ComponentDetails componentId="gateway" />,
      url('/architecture/frontend', { node: 'gateway' }),
    );
    const found = links(html);
    // The frontend is on the Frontend view: the link only selects it.
    expect(found).toContainEqual({
      href: '/architecture/frontend?node=frontend',
      text: docs.getComponent('frontend')?.name,
    });
    // Redis is not, so the link opens it where it is shown, and says so.
    expect(found).toContainEqual({
      href: '/architecture/system?node=redis',
      text: `${docs.getComponent('redis')?.name} ${SYSTEM_HINT}`,
    });
    expect(html).not.toContain('href="/architecture/frontend?node=redis"');
  });

  describe.each(ARCH_VIEWS.map((view) => [view.id, view]))('on the %s view', (_id, view) => {
    const shown = new Set(
      architectureView(view.id, docs.components, docs.links).components.map((c) => c.id),
    );

    it.each(docs.components.map((component) => [component.id]))(
      'links %s only to nodes the page can show',
      (id) => {
        const html = render(
          <ComponentDetails componentId={id} />,
          url(`/architecture/${view.id}`, { node: id }),
        );
        for (const link of links(html)) {
          const target = new URL(link.href, 'http://docs.test');
          const node = target.searchParams.get('node');
          if (!target.pathname.startsWith('/architecture/') || target.searchParams.has('symbol')) {
            continue;
          }
          if (target.pathname === `/architecture/${view.id}`) {
            expect(shown.has(node ?? '')).toBe(true);
          } else {
            expect(target.pathname).toBe('/architecture/system');
            expect(link.text).toContain(SYSTEM_HINT);
          }
        }
      },
    );
  });

  it('drops sections with no data', () => {
    const html = render(<ComponentDetails componentId="pollinations" />, '/architecture/system');
    expect(html).not.toContain('Entry points');
    expect(html).not.toContain('>Code<');
  });

  it('says so when the component is unknown', () => {
    const html = text(render(<ComponentDetails componentId="nope" />));
    expect(html).toContain("This part of the system isn't in the docs");
  });
});

describe('StepDetails', () => {
  const steps = docs.flows.flatMap((flow) => flow.steps.map((step) => [flow.id, step.id]));
  const titles = (neighbours: StepNeighbour[]): string[] =>
    neighbours.map(({ step }) => step.title);

  it.each(steps)('renders %s › %s', (flowId, stepId) => {
    const html = renderStep(flowId, stepId);
    const step = docs.getStep(flowId, stepId);
    expect(text(html)).toContain(step?.title);
    expect(text(html)).toMatch(/Step \d+ of \d+/);

    // A nav button only ever opens a step joined to this one by a line of the flow.
    const flow = docs.getFlow(flowId);
    const [previous, next] = stepNav(html);
    const before = flow ? titles(docs.stepsBefore(flow, stepId)) : [];
    const after = flow ? titles(docs.stepsAfter(flow, stepId)) : [];
    if (previous?.button) expect(before.some((title) => previous.text.endsWith(title))).toBe(true);
    if (next?.button) expect(after.some((title) => next.text.endsWith(title))).toBe(true);
  });

  it('names the function a one-line step sits in', () => {
    const html = text(renderStep('health-check', 'security-headers'));
    expect(html).toContain('This step is one line inside');
    expect(html).toContain('app.use(helmet());');
  });

  it("gives a one-line step's header the function's range, named as such", () => {
    const located = docs.getSymbol('backend/shared/src/health.ts#healthRouter');
    const range =
      located && fileLocation(located.file.path, located.symbol.startLine, located.symbol.endLine);
    expect(range).toBeDefined();
    expect(text(renderStep('health-check', 'response'))).toContain(`in healthRouter · ${range}`);
  });

  it('gives a step that runs a whole function just its location', () => {
    const located = docs.getSymbol('backend/shared/src/requestId.ts#requestId');
    const range =
      located && fileLocation(located.file.path, located.symbol.startLine, located.symbol.endLine);
    const html = text(renderStep('health-check', 'request-id'));
    expect(html).toContain(range);
    expect(html).not.toContain('in requestId ·');
  });

  it('links the part of the system a step runs in to System Architecture', () => {
    const html = renderStep('health-check', 'request-id');
    expect(links(html)).toContainEqual({
      href: '/architecture/system?node=shared',
      text: `${docs.getComponent('shared')?.name} ${SYSTEM_HINT}`,
    });
  });

  describe('Previous and Next follow the lines of the flow', () => {
    it('starts the flow with no Previous step', () => {
      expect(stepNav(renderStep('health-check', 'caller'))).toEqual([
        { button: false, text: '← Previous step Start of the flow' },
        { button: true, text: 'Next step → Give the request an ID' },
      ]);
    });

    it('ends a straight flow with no Next step', () => {
      expect(stepNav(renderStep('health-check', 'response'))).toEqual([
        { button: true, text: '← Previous step Answer that the process is up' },
        { button: false, text: 'Next step → End of this path' },
      ]);
    });

    it('ends a branch without stepping into the other branch', () => {
      expect(stepNav(renderStep('readiness-check', 'response-ready'))).toEqual([
        { button: true, text: '← Previous step Ready only if every check is ok' },
        { button: false, text: 'Next step → End of this path' },
      ]);
    });

    it('skips a check that runs at the same time', () => {
      expect(stepNav(renderStep('readiness-check', 'ping-mongo'))).toEqual([
        { button: true, text: '← Previous step Run every check at once, each with a time limit' },
        { button: true, text: 'Next step → Give up after 2 seconds' },
      ]);
    });

    it('goes on from one branch to where the branches meet', () => {
      expect(stepNav(renderStep('readiness-check', 'record-ok'))).toEqual([
        { button: true, text: '← Previous step Give up after 2 seconds' },
        { button: true, text: 'Next step → Ready only if every check is ok' },
      ]);
    });

    it('points to the lists when the flow splits and when paths meet', () => {
      expect(stepNav(renderStep('readiness-check', 'with-timeout'))).toEqual([
        { button: false, text: '← Previous step 2 steps lead here: see Comes before' },
        { button: false, text: 'Next step → Splits into 2 steps: see Comes after' },
      ]);
      expect(stepNav(renderStep('error-handling', 'to-app-error'))).toEqual([
        { button: true, text: '← Previous step Has the response already started?' },
        { button: false, text: 'Next step → Splits into 5 steps: see Comes after' },
      ]);
      expect(stepNav(renderStep('error-handling', 'error-handler'))).toEqual([
        { button: false, text: '← Previous step 3 steps lead here: see Comes before' },
        { button: true, text: 'Next step → Has the response already started?' },
      ]);
    });
  });

  it('says so when the step is unknown', () => {
    const html = text(renderStep('health-check', 'nope'));
    expect(html).toContain("This step isn't in the docs");
  });
});

describe('SymbolDetails', () => {
  const ids = docs.files.flatMap((file) => file.symbols.map((symbol) => [symbol.id]));
  const healthRouter = 'backend/shared/src/health.ts#healthRouter';

  it.each(ids)('renders %s', (id) => {
    const html = text(render(<SymbolDetails symbolId={id} />));
    expect(html).toContain('← Close');
    expect(html).toContain(docs.getSymbol(id)?.file.path);
  });

  it('shows the note and the facts from the index', () => {
    const html = text(render(<SymbolDetails symbolId={healthRouter} />));
    expect(html).toContain(docs.getNote(healthRouter)?.summary.replaceAll('`', ''));
    expect(html).toContain('GET /healthz');
    expect(html).toContain('Used in flows');
  });

  it('names the step or node it goes back to', () => {
    const onStep = render(
      <SymbolDetails symbolId={healthRouter} />,
      url('/flows/health-check', { step: 'response', symbol: healthRouter }),
    );
    expect(text(onStep)).toContain('← Back to 200 OK');

    const onNode = render(
      <SymbolDetails symbolId={healthRouter} />,
      url('/architecture/system', { node: 'gateway', symbol: healthRouter }),
    );
    expect(text(onNode)).toContain(`← Back to ${docs.getComponent('gateway')?.name}`);
    expect(text(onNode)).not.toContain('Close');

    const onFile = render(
      <SymbolDetails symbolId={healthRouter} />,
      url('/code', { file: 'backend/shared/src/health.ts', symbol: healthRouter }),
    );
    expect(text(onFile)).toContain('← Back to health.ts');
  });

  it('selects its part of the system in place when the open view shows it', () => {
    const symbolId = 'frontend/src/app/(app)/page.tsx#NewChatPage';
    const html = render(
      <SymbolDetails symbolId={symbolId} />,
      url('/architecture/frontend', { node: 'browser', symbol: symbolId }),
    );
    expect(links(html)).toContainEqual({
      href: '/architecture/frontend?node=frontend',
      text: docs.getComponent('frontend')?.name,
    });
  });

  it('names the parameters table once, by the label above it', () => {
    const symbol = docs.files
      .flatMap((file) => file.symbols)
      .find((candidate) => (candidate.params?.length ?? 0) > 0);
    expect(symbol).toBeDefined();
    const html = render(<SymbolDetails symbolId={symbol?.id ?? ''} />);
    expect(html).not.toContain('<caption');
    const labelId = /<table aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelId).toBeDefined();
    const label = html.slice(html.indexOf(`<dt id="${labelId}"`));
    expect(text(label.slice(0, label.indexOf('</dt>')))).toBe('Parameters');
  });

  it('says so when the id is unknown', () => {
    const html = text(render(<SymbolDetails symbolId="nowhere.ts#nothing" />));
    expect(html).toContain("This function isn't in the code index");
    expect(html).toContain('nowhere.ts#nothing');
  });
});

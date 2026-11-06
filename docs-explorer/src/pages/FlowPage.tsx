import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { StepDetails } from '../details/StepDetails.tsx';
import { SymbolDetails } from '../details/SymbolDetails.tsx';
import { FlowGraph } from '../graph/FlowGraph.tsx';
import { useSelection } from '../hooks/use-selection.ts';
import { symbolName } from '../layout/breadcrumbs.ts';
import { Workspace } from '../layout/Workspace.tsx';
import { docs } from '../model/index.ts';
import { FLOW_CATEGORY_LABEL } from '../model/labels.ts';
import { paths } from '../routes.ts';
import { plural } from '../ui/plural.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { parseTrail, startTrail, walkPosition } from '../walkthrough/walk.ts';
import { WalkthroughPanel, type WalkControl } from '../walkthrough/WalkthroughPanel.tsx';
import { NotFoundPage } from './NotFoundPage.tsx';

// One flow (/flows/:flowId): its steps as a graph, and the details of the selected step, or of
// a symbol opened from it. With ?walk in the URL it is a walkthrough instead: the panel follows
// the flow one step at a time and the graph marks the path walked so far.

export function FlowPage() {
  const { flowId } = useParams();
  const flow = flowId === undefined ? undefined : docs.getFlow(flowId);
  const { step, symbol, walk, select, searchWith } = useSelection();
  const navigate = useNavigate();
  // Set by the walkthrough panel before a move, read by the next one (see WalkthroughPanel).
  const walkFocusRef = useRef<WalkControl | null>(null);

  // The trail is checked against the flow, so an old or hand-edited link still gives a legal
  // walk. A walk with no steps (an empty flow) is no walk.
  const trail = useMemo(() => {
    const parsed = flow && walk !== undefined ? parseTrail(flow, walk, step) : undefined;
    return parsed && parsed.length > 0 ? parsed : undefined;
  }, [flow, walk, step]);
  const current = trail?.at(-1);
  const walking = current !== undefined;
  const position = useMemo(
    () => (flow && trail ? walkPosition(flow, trail) : undefined),
    [flow, trail],
  );

  // The trail as of the latest move. A move sets it at once, before the URL and this page catch
  // up, so a second key pressed straight after builds on the first (see WalkthroughPanel).
  const liveTrailRef = useRef<string[] | null>(null);
  useLayoutEffect(() => {
    liveTrailRef.current = trail ?? null;
  }, [trail]);

  // A repaired trail replaces the one in the URL, in place, so the address matches the walk.
  useEffect(() => {
    if (!trail || current === undefined) return;
    const visited = trail.join(',');
    if (visited === walk && current === step) return;
    void navigate(
      { search: searchWith({ step: current, walk: visited, symbol }) },
      { replace: true },
    );
  }, [trail, current, walk, step, symbol, searchWith, navigate]);

  // Moves and the exit are built from the latest trail, not from the URL this page last saw.
  const onMove = useCallback(
    (next: string[]) => {
      if (!flow) return;
      liveTrailRef.current = next;
      void navigate(paths.walkthrough(flow.id, next));
    },
    [flow, navigate],
  );
  // Leaving the walkthrough keeps its current step selected, so its details stay open.
  const onExit = useCallback(() => {
    const latest = liveTrailRef.current;
    if (!flow || !latest) return; // already leaving
    liveTrailRef.current = null;
    void navigate(paths.flow(flow.id, latest.at(-1)));
  }, [flow, navigate]);

  // While walking, clicking a box in the graph ends the walkthrough and selects that step the
  // normal way. A click on the empty canvas leaves the walk alone: Exit or Escape ends it.
  const onSelect = useCallback(
    (stepId: string | undefined) => {
      if (!walking) {
        select({ step: stepId });
      } else if (flow && stepId !== undefined) {
        liveTrailRef.current = null;
        void navigate(paths.flow(flow.id, stepId));
      }
    },
    [flow, walking, select, navigate],
  );
  // During a walk the panel's close button is the same as Exit. A symbol opened from the walk
  // sits on top of it, so closing that goes back to the walk.
  const onClosePanel = useCallback(() => {
    if (walking && symbol) select({ symbol: undefined });
    else if (walking) onExit();
    else select({ step: undefined, symbol: undefined });
  }, [select, walking, symbol, onExit]);

  if (!flow) return <NotFoundPage />;

  const startWalk = () => {
    // The panel that opens puts focus on its Next button.
    walkFocusRef.current = 'start';
    void navigate(paths.walkthrough(flow.id, startTrail(flow)));
  };

  let panel: ReactNode;
  let panelLabel: string | undefined;
  let panelKey: string | undefined;
  const currentTitle =
    current === undefined ? undefined : (docs.getStep(flow.id, current)?.title ?? current);
  const announcement =
    position && currentTitle !== undefined
      ? `Step ${position.number} of ${position.total} on this path: ${currentTitle}`
      : '';
  if (symbol) {
    panel = <SymbolDetails symbolId={symbol} />;
    panelLabel = symbolName(symbol);
    // Names repeat, and step ids repeat across flows, so the key says which flow too.
    panelKey = `${flow.id}:${symbol}`;
  } else if (trail && position) {
    panel = (
      <WalkthroughPanel
        flow={flow}
        trail={trail}
        position={position}
        trailRef={liveTrailRef}
        onMove={onMove}
        onExit={onExit}
        focusRef={walkFocusRef}
      />
    );
    panelLabel = `Walkthrough: ${currentTitle ?? ''}`;
    // Every move is a new key, so the panel starts at the top again.
    panelKey = `${flow.id}:walk:${trail.join(',')}`;
  } else if (step) {
    panel = <StepDetails flowId={flow.id} stepId={step} />;
    panelLabel = docs.getStep(flow.id, step)?.title ?? step;
    panelKey = `${flow.id}:${step}`;
  }

  const route = flow.route ? `${flow.route.method} ${flow.route.path}` : undefined;
  const meta = (
    <>
      <StatusBadge status={flow.status} />
      {/* The title of an API flow is usually its route already. */}
      {route && route !== flow.title ? (
        <span className="font-mono text-fg-muted">{route}</span>
      ) : null}
      <span>{FLOW_CATEGORY_LABEL[flow.category]}</span>
      <span>{plural(flow.steps.length, 'step')}</span>
      {flow.apps.length > 0 ? (
        <span>
          Runs in <span className="font-mono text-fg-muted">{flow.apps.join(', ')}</span>
        </span>
      ) : null}
      {walking ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent px-2 py-0.5 text-accent">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          Walkthrough
        </span>
      ) : flow.steps.length > 0 ? (
        <button
          type="button"
          onClick={startWalk}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-canvas transition-colors hover:bg-accent/85"
        >
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
            <path d="M3.5 2.5v7l6-3.5z" fill="currentColor" />
          </svg>
          Start walkthrough
        </button>
      ) : null}
    </>
  );

  return (
    <>
      <title>{`${flow.title} · GilderAi Docs`}</title>
      {/* Says each walkthrough move out loud. First in the page, so the hidden text sits at
          the top of the scrolling main area and never makes it taller. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
      <Workspace
        title={flow.title}
        summary={flow.summary}
        meta={meta}
        panel={panel}
        panelLabel={panelLabel}
        panelKey={panelKey}
        onClosePanel={onClosePanel}
      >
        <FlowGraph flow={flow} selectedStepId={current ?? step} trail={trail} onSelect={onSelect} />
      </Workspace>
    </>
  );
}

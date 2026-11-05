import { useCallback, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { StepDetails } from '../details/StepDetails.tsx';
import { SymbolDetails } from '../details/SymbolDetails.tsx';
import { FlowGraph } from '../graph/FlowGraph.tsx';
import { useSelection } from '../hooks/use-selection.ts';
import { symbolName } from '../layout/breadcrumbs.ts';
import { Workspace } from '../layout/Workspace.tsx';
import { docs } from '../model/index.ts';
import { FLOW_CATEGORY_LABEL } from '../model/labels.ts';
import { plural } from '../ui/plural.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { NotFoundPage } from './NotFoundPage.tsx';

// One flow (/flows/:flowId): its steps as a graph, and the details of the selected step, or of
// a symbol opened from it.

export function FlowPage() {
  const { flowId } = useParams();
  const flow = flowId === undefined ? undefined : docs.getFlow(flowId);
  const { step, symbol, select } = useSelection();

  const onSelect = useCallback((stepId: string | undefined) => select({ step: stepId }), [select]);
  const onClosePanel = useCallback(() => select({ step: undefined, symbol: undefined }), [select]);

  if (!flow) return <NotFoundPage />;

  let panel: ReactNode;
  let panelLabel: string | undefined;
  if (symbol) {
    panel = <SymbolDetails symbolId={symbol} />;
    panelLabel = symbolName(symbol);
  } else if (step) {
    panel = <StepDetails flowId={flow.id} stepId={step} />;
    panelLabel = docs.getStep(flow.id, step)?.title ?? step;
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
    </>
  );

  return (
    <>
      <title>{`${flow.title} · GilderAi Docs`}</title>
      <Workspace
        title={flow.title}
        summary={flow.summary}
        meta={meta}
        panel={panel}
        panelLabel={panelLabel}
        // Names repeat, and step ids repeat across flows, so the key says which flow too.
        panelKey={symbol || step ? `${flow.id}:${symbol ?? step}` : undefined}
        onClosePanel={onClosePanel}
      >
        <FlowGraph flow={flow} selectedStepId={step} onSelect={onSelect} />
      </Workspace>
    </>
  );
}

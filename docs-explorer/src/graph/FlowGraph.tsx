import { useMemo } from 'react';
import type { Flow } from '../data/schema.ts';
import { docs } from '../model/index.ts';
import { EDGE_KIND_LABEL } from '../model/labels.ts';
import { FLOW_LINE_STYLE, flowLegend, lineEmphasis, nodeEmphasis } from './edge-styles.ts';
import { GraphCanvas, GraphEdge, type GraphLine } from './GraphCanvas.tsx';
import { GraphLegend } from './GraphLegend.tsx';
import { edgeKey, estimateLabelSize, layoutGraph, neighbourhood } from './layout.ts';
import { StepNode, type StepGraphNode } from './StepNode.tsx';

/**
 * One flow, top to bottom: the main path runs down the middle, and conditions, error paths,
 * parallel work and work that finishes later branch off it, each with its own line style and
 * its label on the line. dagre leaves room for the labels, so they never cover a step.
 */

interface FlowGraphProps {
  flow: Flow;
  selectedStepId?: string;
  onSelect: (stepId: string | undefined) => void;
}

const NODE_SIZE = { width: 272, height: 80 };
const nodeTypes = { step: StepNode };
const edgeTypes = { graph: GraphEdge };

export function FlowGraph(props: FlowGraphProps) {
  // A different flow is a different picture: remount, so the first view is placed again.
  return <FlowGraphView key={props.flow.id} {...props} />;
}

function FlowGraphView({ flow, selectedStepId, onSelect }: FlowGraphProps) {
  const stepIds = useMemo(() => new Set(flow.steps.map((step) => step.id)), [flow]);

  const lines = useMemo(
    () =>
      docs
        .flowLines(flow)
        .map((line, index) => ({ ...line, id: edgeKey(line, index) }))
        .filter((line) => stepIds.has(line.from) && stepIds.has(line.to)),
    [flow, stepIds],
  );

  const layout = useMemo(
    () =>
      layoutGraph(
        flow.steps.map((step) => ({ id: step.id, ...NODE_SIZE })),
        lines.map((line) => ({
          id: line.id,
          from: line.from,
          to: line.to,
          label: line.label ? estimateLabelSize(line.label) : undefined,
          // Keep the main path straight; side paths bend around it.
          weight: line.kind === 'next' ? 2 : 1,
        })),
        'TB',
      ),
    [flow, lines],
  );

  const selected =
    selectedStepId !== undefined && stepIds.has(selectedStepId) ? selectedStepId : undefined;
  const lit = useMemo(() => neighbourhood(selected, lines), [selected, lines]);

  const nodes = useMemo(
    (): StepGraphNode[] =>
      flow.steps.map((step, index) => ({
        id: step.id,
        type: 'step',
        position: layout.positions.get(step.id) ?? { x: 0, y: 0 },
        ...NODE_SIZE,
        // The size is fixed, so say so: React Flow then keeps the line anchors when only the
        // data changes, instead of re-measuring every box (and hiding the lines for a frame).
        measured: NODE_SIZE,
        ariaRole: 'group',
        data: {
          step,
          number: index + 1,
          emphasis: nodeEmphasis(step.id, selected, lit?.nodes),
          onSelect,
        },
      })),
    [flow, layout, selected, lit, onSelect],
  );

  const edges = useMemo((): GraphLine[] => {
    const titles = new Map(flow.steps.map((step) => [step.id, step.title]));
    return lines.map((line) => {
      const route = layout.routes.get(line.id);
      const kind = EDGE_KIND_LABEL[line.kind];
      const from = titles.get(line.from) ?? line.from;
      const to = titles.get(line.to) ?? line.to;
      const title = `${from} → ${to}: ${kind}${line.label ? `, ${line.label}` : ''}`;
      return {
        id: line.id,
        type: 'graph',
        source: line.from,
        target: line.to,
        ariaLabel: title,
        data: {
          points: route?.points ?? [],
          labelAt: route?.labelAt ?? { x: 0, y: 0 },
          line: FLOW_LINE_STYLE[line.kind],
          emphasis: lineEmphasis(line.id, lit?.edges),
          chip: line.label,
          title,
        },
      };
    });
  }, [flow, lines, layout, lit]);

  const legend = useMemo(() => flowLegend(new Set(lines.map((line) => line.kind))), [lines]);

  return (
    <GraphCanvas
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      direction="TB"
      ariaLabel={`Flow graph: ${flow.title}`}
      onClearSelection={() => onSelect(undefined)}
      focusId={selected}
    >
      <GraphLegend sections={legend} />
    </GraphCanvas>
  );
}

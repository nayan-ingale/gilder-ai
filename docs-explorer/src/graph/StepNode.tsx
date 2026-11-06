import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { STATUS_INFO, type FlowStep, type StepKind } from '../data/schema.ts';
import { STEP_KIND_LABEL } from '../model/labels.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import type { NodeEmphasis } from './edge-styles.ts';

/**
 * One step in a flow graph: its number in the list, what kind of step it is (an icon plus the
 * word, never colour alone), its title and how sure the docs are. The box is a button; the
 * selected one is marked aria-current, and selecting it again does nothing. Steps already
 * passed in a walkthrough get a bar down their left edge (graph.css) and say so in their name.
 */

export type StepNodeData = {
  step: FlowStep;
  /** Position in the flow's step list, from 1. */
  number: number;
  emphasis: NodeEmphasis;
  /** Already passed in a walkthrough (the current step is the selected one instead). */
  visited?: boolean;
  onSelect: (id: string) => void;
};

export type StepGraphNode = Node<StepNodeData, 'step'>;

export function StepNode({ data }: NodeProps<StepGraphNode>) {
  const { step, number, emphasis, visited = false, onSelect } = data;
  const kind = STEP_KIND_LABEL[step.kind];
  const label = `Step ${number}: ${step.title}, ${kind}, ${STATUS_INFO[step.status].label}${visited ? ', visited in this walkthrough' : ''}`;

  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <button
        type="button"
        aria-label={label}
        aria-current={emphasis === 'selected' ? 'true' : undefined}
        data-emphasis={emphasis}
        data-visited={visited ? 'true' : undefined}
        onClick={() => {
          if (emphasis !== 'selected') onSelect(step.id);
        }}
        className="gx-node flex size-full cursor-pointer flex-col gap-1.5 overflow-hidden rounded-lg border border-line bg-surface px-3 py-2.5 text-left hover:bg-raised"
      >
        <span className="flex w-full items-center gap-2 text-xs text-fg-subtle">
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-line px-1 font-mono text-[11px] text-fg-muted">
            {number}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <StepKindIcon kind={step.kind} />
            <span className="truncate">{kind}</span>
          </span>
          <StatusBadge status={step.status} />
        </span>
        <span className="line-clamp-2 text-[13px] leading-snug font-medium text-fg">
          {step.title}
        </span>
      </button>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

// 12×12 line drawings, one per step kind. Decorative: the kind is also written next to it.
const KIND_ICON: Record<StepKind, string> = {
  // A play triangle: where the flow starts.
  trigger: 'M3.5 2.5v7l6-3.5z',
  // Stacked layers: middleware wraps every request.
  middleware: 'M6 1.75 10.5 4 6 6.25 1.5 4zM1.5 6.75 6 9l4.5-2.25',
  // Angle brackets: the code that handles the route.
  handler: 'M4.25 3 1.5 6l2.75 3M7.75 3l2.75 3-2.75 3',
  // Parentheses: a plain function call.
  function: 'M4.5 1.75C2.75 3.5 2.75 8.5 4.5 10.25M7.5 1.75c1.75 1.75 1.75 6.75 0 8.5',
  // A cylinder: a data store.
  datastore:
    'M2 3c0-.83 1.8-1.5 4-1.5s4 .67 4 1.5-1.8 1.5-4 1.5S2 3.83 2 3zm0 0v6c0 .83 1.8 1.5 4 1.5s4-.67 4-1.5V3',
  // An arrow leaving a box: an outside service.
  external: 'M6.5 1.75h3.75V5.5M10.25 1.75 5.5 6.5M8.75 7.25v3h-7v-7h3',
  // A return arrow: the reply goes back.
  response: 'M10.25 2.5v3.25a1.5 1.5 0 0 1-1.5 1.5H2M4.5 4.75 2 7.25l2.5 2.5',
  // A warning triangle: something went wrong.
  error: 'M6 1.75 10.75 10H1.25zM6 5v2.25M6 8.6v.1',
};

function StepKindIcon({ kind }: { kind: StepKind }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`size-3 shrink-0 ${kind === 'error' ? 'text-edge-error' : 'text-fg-subtle'}`}
    >
      <path
        d={KIND_ICON[kind]}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

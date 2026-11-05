import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { STATUS_INFO, type ArchComponent } from '../data/schema.ts';
import { COMPONENT_KIND_LABEL } from '../model/labels.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import type { NodeEmphasis } from './edge-styles.ts';

/**
 * One box in the architecture graph: an app, data store or outside service. The whole box is
 * a button, so the graph has one tab stop per component and Enter or Space selects it. The
 * selected box is marked aria-current; selecting it again does nothing.
 */

export type ComponentNodeData = {
  component: ArchComponent;
  /** Shown only because it connects to the components this view is about. */
  context: boolean;
  emphasis: NodeEmphasis;
  onSelect: (id: string) => void;
};

export type ComponentGraphNode = Node<ComponentNodeData, 'component'>;

export function ComponentNode({ data }: NodeProps<ComponentGraphNode>) {
  const { component, context, emphasis, onSelect } = data;
  const kind = COMPONENT_KIND_LABEL[component.kind];
  const status = STATUS_INFO[component.status].label;
  const planned = component.status === 'planned';
  const label = [
    component.name,
    kind,
    planned && component.plannedIn ? `${status} (${component.plannedIn})` : status,
    context ? 'shown for context' : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <button
        type="button"
        aria-label={label}
        aria-current={emphasis === 'selected' ? 'true' : undefined}
        data-emphasis={emphasis}
        data-planned={planned}
        data-context={context}
        onClick={() => {
          if (emphasis !== 'selected') onSelect(component.id);
        }}
        className="gx-node flex size-full cursor-pointer flex-col items-start gap-1 overflow-hidden rounded-lg border border-line bg-surface px-3 py-2.5 text-left hover:bg-raised"
      >
        <span className="flex w-full items-center justify-between gap-2 text-xs text-fg-subtle">
          <span className="truncate">
            {kind}
            {context ? ' · context' : null}
          </span>
          {component.port !== undefined ? (
            <span className="shrink-0 font-mono">:{component.port}</span>
          ) : null}
        </span>
        <span className="line-clamp-2 flex-1 text-[13px] leading-snug font-medium text-fg">
          {component.name}
        </span>
        <StatusBadge status={component.status} plannedIn={component.plannedIn} />
      </button>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </>
  );
}

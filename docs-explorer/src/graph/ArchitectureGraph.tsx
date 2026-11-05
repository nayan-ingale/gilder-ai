import { useMemo } from 'react';
import { STATUS_INFO, type ArchComponent, type ArchLink } from '../data/schema.ts';
import { LINK_KIND_LABEL } from '../model/labels.ts';
import { ComponentNode, type ComponentGraphNode } from './ComponentNode.tsx';
import { architectureLegend, lineEmphasis, linkLineStyle, nodeEmphasis } from './edge-styles.ts';
import { GraphCanvas, GraphEdge, type GraphLine } from './GraphCanvas.tsx';
import { GraphLegend } from './GraphLegend.tsx';
import { edgeKey, layoutGraph, neighbourhood } from './layout.ts';

/**
 * The system map: components as boxes, left to right in the order requests travel, and the
 * links between them. Link labels are whole sentences, so lines carry only a short kind chip,
 * and only while they touch the selected box; the sentence is the line's tooltip.
 */

interface ArchitectureGraphProps {
  components: ArchComponent[];
  links: ArchLink[];
  contextIds: Set<string>;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

const NODE_SIZE = { width: 264, height: 104 };
const nodeTypes = { component: ComponentNode };
const edgeTypes = { graph: GraphEdge };

export function ArchitectureGraph({
  components,
  links,
  contextIds,
  selectedId,
  onSelect,
}: ArchitectureGraphProps) {
  const byId = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components],
  );

  // Links whose both ends are on screen, each with an id that stays unique if two links ever
  // join the same pair of components.
  const shownLinks = useMemo(
    () =>
      links
        .map((link, index) => ({ link, id: edgeKey(link, index) }))
        .filter(({ link }) => byId.has(link.from) && byId.has(link.to)),
    [links, byId],
  );

  const layout = useMemo(
    () =>
      layoutGraph(
        components.map((component) => ({ id: component.id, ...NODE_SIZE })),
        shownLinks.map(({ link, id }) => ({ id, from: link.from, to: link.to })),
        'LR',
      ),
    [components, shownLinks],
  );

  const selected = selectedId !== undefined && byId.has(selectedId) ? selectedId : undefined;
  const lit = useMemo(
    () =>
      neighbourhood(
        selected,
        shownLinks.map(({ link, id }) => ({ id, from: link.from, to: link.to })),
      ),
    [selected, shownLinks],
  );

  const nodes = useMemo(
    (): ComponentGraphNode[] =>
      components.map((component) => ({
        id: component.id,
        type: 'component',
        position: layout.positions.get(component.id) ?? { x: 0, y: 0 },
        ...NODE_SIZE,
        // The size is fixed, so say so: React Flow then keeps the line anchors when only the
        // data changes, instead of re-measuring every box (and hiding the lines for a frame).
        measured: NODE_SIZE,
        ariaRole: 'group',
        data: {
          component,
          context: contextIds.has(component.id),
          emphasis: nodeEmphasis(component.id, selected, lit?.nodes),
          onSelect,
        },
      })),
    [components, layout, contextIds, selected, lit, onSelect],
  );

  const edges = useMemo(
    (): GraphLine[] =>
      shownLinks.map(({ link, id }) => {
        const route = layout.routes.get(id);
        const emphasis = lineEmphasis(id, lit?.edges);
        const from = byId.get(link.from)?.name ?? link.from;
        const to = byId.get(link.to)?.name ?? link.to;
        const status =
          link.status === 'planned' && link.plannedIn
            ? `${STATUS_INFO[link.status].label} (${link.plannedIn})`
            : STATUS_INFO[link.status].label;
        const title = `${from} → ${to}: ${link.label.replace(/\.$/, '')}. ${LINK_KIND_LABEL[link.kind]}, ${status}.`;
        return {
          id,
          type: 'graph',
          source: link.from,
          target: link.to,
          ariaLabel: title,
          data: {
            points: route?.points ?? [],
            labelAt: route?.labelAt ?? { x: 0, y: 0 },
            line: linkLineStyle(link.kind, link.status),
            emphasis,
            chip: emphasis === 'highlight' ? LINK_KIND_LABEL[link.kind] : undefined,
            title,
          },
        };
      }),
    [shownLinks, layout, lit, byId],
  );

  const legend = useMemo(
    () =>
      architectureLegend(
        components,
        shownLinks.map(({ link }) => link),
        contextIds,
      ),
    [components, shownLinks, contextIds],
  );

  // A new set of components is a new picture: remount, so the first view is placed again.
  const graphKey = components.map((component) => component.id).join('|');

  return (
    <GraphCanvas
      key={graphKey}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      direction="LR"
      ariaLabel="Architecture graph"
      onClearSelection={() => onSelect(undefined)}
      focusId={selected}
    >
      <GraphLegend sections={legend} />
    </GraphCanvas>
  );
}

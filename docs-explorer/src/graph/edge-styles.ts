import {
  STATUS_INFO,
  type ArchComponent,
  type ArchLink,
  type EdgeKind,
  type LinkKind,
  type Status,
} from '../data/schema.ts';
import { EDGE_KIND_LABEL, LINK_KIND_LABEL } from '../model/labels.ts';

/**
 * How each kind of line looks, in one place, so the graphs and their legends always match.
 * Every kind differs by its dash pattern or the shape at its ends, never by colour alone.
 * Colours are design-token variables from styles.css, written out in full so Tailwind sees
 * them and keeps the variables in the build.
 */

/** The shape drawn at the end of a line. All of them point (or sit) at the box they reach. */
export type MarkerShape = 'arrow' | 'hollow-arrow' | 'chevron' | 'circle' | 'diamond';

export interface LineStyle {
  /** Stroke colour: a CSS variable. */
  stroke: string;
  /** Stroke colour while the line touches the selected box. */
  highlightStroke: string;
  /** SVG stroke-dasharray; undefined for a solid line. */
  dash?: string;
  width: number;
  /** Round caps turn a short dash pattern into dots. */
  roundCaps?: boolean;
  /** Drawn as two thin parallel lines (a wide stroke with a hollow core). */
  double?: boolean;
  markerEnd?: MarkerShape;
  markerStart?: MarkerShape;
  /** Opacity when nothing is selected. Planned links are faded. */
  opacity: number;
}

/** The page background: fills hollow shapes and the gap inside a double line. */
export const CANVAS_FILL = 'var(--color-canvas)';

/**
 * Each marker drawn in its own units: (0, 0) is where the line ends and +x points along the
 * line, so the tip touches the box. `fill` says whether the inside takes the line colour, the
 * page background (hollow) or nothing (open).
 */
export const MARKER_SHAPE: Record<
  MarkerShape,
  { path: string; fill: 'line' | 'canvas' | 'none'; strokeWidth: number }
> = {
  arrow: { path: 'M -9 -4.5 L 0 0 L -9 4.5 Z', fill: 'line', strokeWidth: 1 },
  'hollow-arrow': { path: 'M -9.5 -4.75 L 0 0 L -9.5 4.75 Z', fill: 'canvas', strokeWidth: 1.25 },
  chevron: { path: 'M -7.5 -4.5 L 0 0 L -7.5 4.5', fill: 'none', strokeWidth: 1.5 },
  circle: {
    path: 'M -7.5 0 A 3.75 3.75 0 1 0 0 0 A 3.75 3.75 0 1 0 -7.5 0 Z',
    fill: 'line',
    strokeWidth: 1,
  },
  diamond: { path: 'M 0 0 L -5.5 -4 L -11 0 L -5.5 4 Z', fill: 'canvas', strokeWidth: 1.25 },
};

/** The marker's drawing area, in the units above: every shape fits inside it. */
export const MARKER_VIEWBOX = { x: -12.5, y: -6, width: 14, height: 12 };

/** How much a box or line stands out, given what is selected. */
export type NodeEmphasis = 'normal' | 'selected' | 'connected' | 'dimmed';
export type LineEmphasis = 'normal' | 'highlight' | 'dimmed';

/** Lines away from the selection fade right back (their labels switch to subtle text). */
export const DIMMED_LINE_OPACITY = 0.15;

/** The colour, width and opacity a line is drawn with in each state. */
export function lineAppearance(
  line: LineStyle,
  emphasis: LineEmphasis,
): { stroke: string; width: number; opacity: number } {
  if (emphasis === 'highlight') {
    return { stroke: line.highlightStroke, width: line.width + 0.5, opacity: 1 };
  }
  if (emphasis === 'dimmed') {
    return { stroke: line.stroke, width: line.width, opacity: DIMMED_LINE_OPACITY };
  }
  return { stroke: line.stroke, width: line.width, opacity: line.opacity };
}

export function nodeEmphasis(
  id: string,
  selectedId: string | undefined,
  lit: Set<string> | undefined,
): NodeEmphasis {
  if (selectedId === undefined || !lit) return 'normal';
  if (id === selectedId) return 'selected';
  return lit.has(id) ? 'connected' : 'dimmed';
}

export function lineEmphasis(id: string, lit: Set<string> | undefined): LineEmphasis {
  if (!lit) return 'normal';
  return lit.has(id) ? 'highlight' : 'dimmed';
}

// ---------------------------------------------------------------------------------------------
// Flow lines (schema.ts EdgeKind)

export const FLOW_LINE_STYLE: Record<EdgeKind, LineStyle> = {
  // The main path: a plain solid line.
  next: {
    stroke: 'var(--color-edge-next)',
    highlightStroke: 'var(--color-fg-muted)',
    width: 1.5,
    markerEnd: 'arrow',
    opacity: 1,
  },
  // A condition: solid, starting from a diamond like a flowchart decision.
  branch: {
    stroke: 'var(--color-edge-branch)',
    highlightStroke: 'var(--color-edge-branch)',
    width: 1.5,
    markerStart: 'diamond',
    markerEnd: 'arrow',
    opacity: 1,
  },
  // A failure path: dashed.
  error: {
    stroke: 'var(--color-edge-error)',
    highlightStroke: 'var(--color-edge-error)',
    width: 1.5,
    dash: '6 4',
    markerEnd: 'arrow',
    opacity: 1,
  },
  // Work that runs at the same time: a double line.
  parallel: {
    stroke: 'var(--color-edge-parallel)',
    highlightStroke: 'var(--color-fg-muted)',
    width: 4.5,
    double: true,
    markerEnd: 'chevron',
    opacity: 1,
  },
  // Work that finishes later: dotted, with an open arrowhead.
  async: {
    stroke: 'var(--color-edge-async)',
    highlightStroke: 'var(--color-fg-muted)',
    width: 1.75,
    dash: '0.5 4.5',
    roundCaps: true,
    markerEnd: 'chevron',
    opacity: 1,
  },
};

// ---------------------------------------------------------------------------------------------
// Architecture links: the kind sets the shape at the end, the status sets the dash pattern.

const LINK_MARKER: Record<LinkKind, MarkerShape> = {
  http: 'arrow',
  internal: 'chevron',
  data: 'circle',
  external: 'hollow-arrow',
};

/**
 * Traced links are solid; every other status has its own dash pattern, from long dashes
 * (mostly traced) to short ones (inferred), dots (not wired) and dash-dot (unknown). Planned
 * links are also faded.
 */
const STATUS_DASH: Record<Status, { dash?: string; roundCaps?: boolean }> = {
  verified: {},
  partial: { dash: '12 3' },
  inferred: { dash: '2 3' },
  'not-wired': { dash: '0.5 4', roundCaps: true },
  planned: { dash: '6 4' },
  unknown: { dash: '8 3 1 3' },
};

export function linkLineStyle(kind: LinkKind, status: Status): LineStyle {
  return {
    stroke: 'var(--color-edge-next)',
    highlightStroke: 'var(--color-accent)',
    width: 1.5,
    ...STATUS_DASH[status],
    markerEnd: LINK_MARKER[kind],
    opacity: status === 'planned' ? 0.5 : 1,
  };
}

// ---------------------------------------------------------------------------------------------
// Legends: one row per line style or box style that appears in the graph on screen.

export type LegendItem =
  | { type: 'line'; key: string; label: string; line: LineStyle }
  | { type: 'box'; key: string; label: string; look: 'planned' | 'context' };

export interface LegendSection {
  title: string;
  items: LegendItem[];
}

const EDGE_KIND_ORDER: EdgeKind[] = ['next', 'branch', 'error', 'parallel', 'async'];
const LINK_KIND_ORDER: LinkKind[] = ['http', 'internal', 'data', 'external'];
const STATUS_ORDER: Status[] = [
  'verified',
  'partial',
  'inferred',
  'not-wired',
  'planned',
  'unknown',
];

export function flowLegend(kinds: Set<EdgeKind>): LegendSection[] {
  const items = EDGE_KIND_ORDER.filter((kind) => kinds.has(kind)).map((kind): LegendItem => ({
    type: 'line',
    key: kind,
    label: EDGE_KIND_LABEL[kind],
    line: FLOW_LINE_STYLE[kind],
  }));
  return items.length > 0 ? [{ title: 'Lines', items }] : [];
}

export function architectureLegend(
  components: ArchComponent[],
  links: ArchLink[],
  contextIds: Set<string>,
): LegendSection[] {
  const sections: LegendSection[] = [];

  const kinds = new Set(links.map((link) => link.kind));
  const kindItems = LINK_KIND_ORDER.filter((kind) => kinds.has(kind)).map((kind): LegendItem => ({
    type: 'line',
    key: `kind-${kind}`,
    label: LINK_KIND_LABEL[kind],
    line: { ...linkLineStyle(kind, 'verified'), opacity: 1 },
  }));
  if (kindItems.length > 0) sections.push({ title: 'Connections', items: kindItems });

  // One row per status in view; left out when every line is plain solid (all verified).
  const statuses = new Set(links.map((link) => link.status));
  const statusItems = STATUS_ORDER.filter((status) => statuses.has(status)).map(
    (status): LegendItem => ({
      type: 'line',
      key: `status-${status}`,
      label: STATUS_INFO[status].label,
      line: { ...linkLineStyle('http', status), markerEnd: undefined },
    }),
  );
  if (statusItems.some((item) => item.type === 'line' && item.line.dash !== undefined)) {
    sections.push({ title: 'Status', items: statusItems });
  }

  const boxItems: LegendItem[] = [];
  if (components.some((component) => component.status === 'planned')) {
    boxItems.push({
      type: 'box',
      key: 'planned',
      label: 'Planned: not built yet',
      look: 'planned',
    });
  }
  if (components.some((component) => contextIds.has(component.id))) {
    boxItems.push({
      type: 'box',
      key: 'context',
      label: 'Faded: shown for context',
      look: 'context',
    });
  }
  if (boxItems.length > 0) sections.push({ title: 'Boxes', items: boxItems });

  return sections;
}

/** How to move around the graph, in the words of the device in hand. */
export function navigationHint({ mac, touchOnly }: { mac: boolean; touchOnly: boolean }): string {
  if (touchOnly) return 'Drag to move · Pinch to zoom';
  return `Scroll to move · Pinch or ${mac ? '⌘' : 'Ctrl'} + scroll to zoom`;
}

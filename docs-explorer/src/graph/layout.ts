import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from '@dagrejs/dagre';

/**
 * Where everything goes in a graph. dagre places the boxes in ranks (left to right for the
 * architecture, top to bottom for a flow) and routes each line around them; React Flow then
 * only draws. Also where the view opens and how it follows the selection. Pure functions, so
 * the result is the same on every render and easy to test.
 */

export type LayoutDirection = 'LR' | 'TB';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface LayoutNode extends Size {
  id: string;
}

export interface LayoutEdge {
  /** Unique among the edges; defaults to `from->to#index`. */
  id?: string;
  from: string;
  to: string;
  /** Space to keep free on the line for its label, so labels never sit on a box. */
  label?: Size;
  /** How much dagre tries to keep this line short and straight (default 1). */
  weight?: number;
}

export interface EdgeRoute {
  /** The line, from the edge of the source box to the edge of the target box. */
  points: Point[];
  /** Where the line's label (or chip) goes: dagre's label spot, or the middle of the line. */
  labelAt: Point;
}

export interface GraphLayout {
  /** Top-left corner of each box, as React Flow wants it. */
  positions: Map<string, Point>;
  /** Each kept edge's route, by edge id. Edges to unknown nodes are left out. */
  routes: Map<string, EdgeRoute>;
  width: number;
  height: number;
}

interface Spacing {
  /** Gap between boxes in the same rank. */
  nodesep: number;
  /** Gap between ranks. */
  ranksep: number;
  /** Gap between lines running side by side. */
  edgesep: number;
}

const SPACING: Record<LayoutDirection, Spacing> = {
  LR: { nodesep: 24, ranksep: 88, edgesep: 12 },
  TB: { nodesep: 36, ranksep: 44, edgesep: 16 },
};

/** The id an edge gets when it has none: stable, and unique even when two lines join the same boxes. */
export const edgeKey = (edge: Pick<LayoutEdge, 'id' | 'from' | 'to'>, index: number): string =>
  edge.id ?? `${edge.from}->${edge.to}#${index}`;

export function layoutGraph(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: LayoutDirection,
): GraphLayout {
  if (nodes.length === 0) return { positions: new Map(), routes: new Map(), width: 0, height: 0 };
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>({ multigraph: true });
  graph.setGraph({ rankdir: direction, marginx: 0, marginy: 0, ...SPACING[direction] });
  graph.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) graph.setNode(node.id, { width: node.width, height: node.height });

  const kept: { key: string; edge: LayoutEdge }[] = [];
  edges.forEach((edge, index) => {
    if (!sizes.has(edge.from) || !sizes.has(edge.to)) return;
    const key = edgeKey(edge, index);
    graph.setEdge(
      edge.from,
      edge.to,
      {
        minlen: 1,
        weight: edge.weight ?? 1,
        width: edge.label?.width ?? 0,
        height: edge.label?.height ?? 0,
        labelpos: 'c',
      },
      key,
    );
    kept.push({ key, edge });
  });

  layout(graph);

  const positions = new Map<string, Point>();
  for (const node of nodes) {
    const placed = graph.node(node.id);
    positions.set(node.id, {
      x: (placed.x ?? 0) - node.width / 2,
      y: (placed.y ?? 0) - node.height / 2,
    });
  }

  const routes = new Map<string, EdgeRoute>();
  for (const { key, edge } of kept) {
    const routed = graph.edge(edge.from, edge.to, key);
    const points = (routed.points ?? []).map(({ x, y }) => ({ x, y }));
    const labelAt =
      edge.label && routed.x !== undefined && routed.y !== undefined
        ? { x: routed.x, y: routed.y }
        : pointAlong(points, 0.5);
    routes.set(key, { points, labelAt });
  }

  const size = graph.graph();
  return { positions, routes, width: size.width ?? 0, height: size.height ?? 0 };
}

/** The point a fraction of the way along a polyline, measured by length. */
export function pointAlong(points: Point[], fraction: number): Point {
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  const segments = points.slice(1).map((end, index) => {
    const start = points[index] ?? end;
    return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
  });
  let remaining = segments.reduce((sum, segment) => sum + segment.length, 0) * fraction;
  for (const { start, end, length } of segments) {
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    }
    remaining -= length;
  }
  return points[points.length - 1] ?? first;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * An SVG path through every route point (a Catmull-Rom spline drawn as cubic curves), so bends
 * are smooth and labels placed on route points sit exactly on the line. The curve leaves and
 * reaches the ends along the first and last stretch, so the arrowhead points along the line.
 */
export function linePath(points: Point[]): string {
  const first = points[0];
  const second = points[1];
  if (!first) return '';
  const start = `M ${round(first.x)} ${round(first.y)}`;
  if (!second) return start;
  if (points.length === 2) return `${start} L ${round(second.x)} ${round(second.y)}`;
  let path = start;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) continue;
    const before = points[index - 1] ?? from;
    const after = points[index + 2] ?? to;
    const c1 = { x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 };
    const c2 = { x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 };
    path += ` C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.x)} ${round(to.y)}`;
  }
  return path;
}

/**
 * Roughly how big a label chip will be, so dagre can keep the space free before anything is
 * drawn. Errs on the large side: a little extra room is fine, an overlap is not.
 */
export function estimateLabelSize(text: string, maxWidth = 176): Size {
  const charWidth = 6.2;
  const lineHeight = 16;
  const padX = 14;
  const padY = 8;
  const textWidth = text.length * charWidth;
  // Word wrapping leaves ragged lines, so assume each line holds a bit less than it could.
  const lines = Math.max(1, Math.ceil(textWidth / ((maxWidth - padX) * 0.9)));
  return {
    width: Math.min(maxWidth, Math.ceil(textWidth) + padX),
    height: lines * lineHeight + padY,
  };
}

/** The boxes and lines next to a selected box: what stays lit while the rest dims. */
export interface Neighbourhood {
  nodes: Set<string>;
  edges: Set<string>;
}

export function neighbourhood(
  selectedId: string | undefined,
  edges: { id: string; from: string; to: string }[],
): Neighbourhood | undefined {
  if (selectedId === undefined) return undefined;
  const nodes = new Set([selectedId]);
  const touching = new Set<string>();
  for (const edge of edges) {
    if (edge.from !== selectedId && edge.to !== selectedId) continue;
    touching.add(edge.id);
    nodes.add(edge.from);
    nodes.add(edge.to);
  }
  return { nodes, edges: touching };
}

// ---------------------------------------------------------------------------------------------
// The view: where the camera starts, and how it follows the selection. Screen position of a
// graph point p is p * zoom + (x, y), as in React Flow's viewport.

export interface Rect extends Point, Size {}

export interface Viewport extends Point {
  zoom: number;
}

/** The smallest zoom the graph opens at: 13 px titles show at about 10.5 px, still readable. */
export const READABLE_ZOOM = 0.8;

/** The box around all the given boxes. */
export function boundsOf(rects: Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export interface InitialViewOptions {
  /** Every box in the graph, in graph coordinates. The list order breaks ties for the start. */
  rects: Rect[];
  pane: Size;
  direction: LayoutDirection;
  /** Screen space kept free around the graph. */
  margin?: number;
  readableZoom?: number;
  maxZoom?: number;
}

/**
 * Where the graph opens. If it all fits at a readable zoom, it is fitted and centred. If not,
 * it opens at the readable zoom where it starts: a top-to-bottom flow at its top, a
 * left-to-right map at its left edge. Across that direction it is centred when it fits, and
 * otherwise centred on the first box (kept within the graph, so no empty space shows).
 */
export function initialViewport({
  rects,
  pane,
  direction,
  margin = 32,
  readableZoom = READABLE_ZOOM,
  maxZoom = 1,
}: InitialViewOptions): Viewport {
  const bounds = boundsOf(rects);
  if (!bounds || pane.width <= 0 || pane.height <= 0) return { x: 0, y: 0, zoom: 1 };

  const roomX = Math.max(1, pane.width - 2 * margin);
  const roomY = Math.max(1, pane.height - 2 * margin);
  const fit = Math.min(
    roomX / Math.max(bounds.width, 1),
    roomY / Math.max(bounds.height, 1),
    maxZoom,
  );
  if (fit >= readableZoom) {
    return {
      zoom: fit,
      x: pane.width / 2 - (bounds.x + bounds.width / 2) * fit,
      y: pane.height / 2 - (bounds.y + bounds.height / 2) * fit,
    };
  }

  const zoom = Math.min(readableZoom, maxZoom);
  const main = direction === 'TB' ? 'y' : 'x';
  // The first box: the one nearest the start edge, the earlier one in the list on a tie.
  const start = rects.reduce((best, rect) => (rect[main] < best[main] ? rect : best));

  const axis = (
    lo: number,
    size: number,
    startCentre: number,
    paneSize: number,
    isMain: boolean,
  ) => {
    if (size * zoom <= paneSize - 2 * margin) return paneSize / 2 - (lo + size / 2) * zoom;
    const nearEdge = margin - lo * zoom;
    if (isMain) return nearEdge;
    const farEdge = paneSize - margin - (lo + size) * zoom;
    return Math.min(nearEdge, Math.max(farEdge, paneSize / 2 - startCentre * zoom));
  };

  return {
    zoom,
    x: axis(bounds.x, bounds.width, start.x + start.width / 2, pane.width, main === 'x'),
    y: axis(bounds.y, bounds.height, start.y + start.height / 2, pane.height, main === 'y'),
  };
}

/** The area two rectangles share; 0 when they only touch or don't meet. */
const overlapArea = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

const grow = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + 2 * by,
  height: rect.height + 2 * by,
});

export interface RevealOptions {
  /**
   * Screen pixels a sheet covers along the bottom of the pane (the details sheet on phones).
   * A hard limit: the box always ends up fully above it.
   */
  insetBottom?: number;
  /**
   * What is drawn over the pane (legend, zoom buttons, mini-map, credit link), in screen
   * coordinates. A soft limit: the box keeps clear of each one where there is room, and
   * accepts the smallest overlap where there isn't.
   */
  overlays?: Rect[];
  /** Space kept from the edges and the overlays, when there is room for it. */
  gap?: number;
}

/**
 * The view that brings a box into sight at the same zoom; undefined when it already is, so
 * the view only moves when it has to.
 *
 * In sight means fully inside the pane and fully above the bottom inset (always), and clear of
 * every overlay (when possible). Each overlay blocks only the rectangle it really covers. When
 * the box has to move, the candidate spots are the middle of the visible area and the spots
 * just beside each overlay; the winner overlaps the overlays least, then sits nearest the
 * middle.
 */
export function revealViewport(
  viewport: Viewport,
  rect: Rect,
  pane: Size,
  { insetBottom = 0, overlays = [], gap = 8 }: RevealOptions = {},
): Viewport | undefined {
  const { zoom } = viewport;
  const width = rect.width * zoom;
  const height = rect.height * zoom;
  const area = { width: pane.width, height: Math.max(0, pane.height - Math.max(0, insetBottom)) };

  // Where the box's top-left corner may go: inside the visible area, `gap` in when there is
  // room. A box too big for it is centred across and shows its top (the title).
  const range = (size: number, room: number, tooBig: number): [number, number] => {
    if (size > room) return [tooBig, tooBig];
    const margin = Math.min(gap, (room - size) / 2);
    return [margin, room - size - margin];
  };
  const [minX, maxX] = range(width, area.width, (area.width - width) / 2);
  const [minY, maxY] = range(height, area.height, 0);
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const boxAt = (spot: Point): Rect => ({ ...spot, width, height });
  const cost = (spot: Point, pad: number) =>
    overlays.reduce((sum, overlay) => sum + overlapArea(boxAt(spot), grow(overlay, pad)), 0);
  const fullyVisible = (spot: Point) =>
    spot.x >= 0 && spot.y >= 0 && spot.x + width <= area.width && spot.y + height <= area.height;

  const current = { x: rect.x * zoom + viewport.x, y: rect.y * zoom + viewport.y };
  if (fullyVisible(current) && cost(current, gap) === 0) return undefined;

  const middle = { x: (area.width - width) / 2, y: (area.height - height) / 2 };
  const xs = [middle.x, minX, maxX];
  const ys = [middle.y, minY, maxY];
  for (const overlay of overlays) {
    xs.push(overlay.x - gap - width, overlay.x + overlay.width + gap);
    ys.push(overlay.y - gap - height, overlay.y + overlay.height + gap);
  }
  const target = { x: clamp(middle.x, minX, maxX), y: clamp(middle.y, minY, maxY) };
  let best = { spot: target, hard: cost(target, 0), soft: cost(target, gap), distance: 0 };
  for (const x of xs) {
    for (const y of ys) {
      const spot = { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
      const hard = cost(spot, 0);
      const soft = cost(spot, gap);
      const distance = Math.hypot(spot.x - target.x, spot.y - target.y);
      const better =
        hard < best.hard ||
        (hard === best.hard && soft < best.soft) ||
        (hard === best.hard && soft === best.soft && distance < best.distance);
      if (better) best = { spot, hard, soft, distance };
    }
  }

  // Already in sight and no spot overlaps less: stay put rather than move for nothing.
  if (fullyVisible(current) && cost(current, 0) <= best.hard && cost(current, gap) <= best.soft) {
    return undefined;
  }
  return { zoom, x: best.spot.x - rect.x * zoom, y: best.spot.y - rect.y * zoom };
}

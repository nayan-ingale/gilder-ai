import { describe, expect, it } from 'vitest';
import {
  READABLE_ZOOM,
  boundsOf,
  estimateLabelSize,
  initialViewport,
  layoutGraph,
  linePath,
  neighbourhood,
  pointAlong,
  revealViewport,
  type LayoutEdge,
  type LayoutNode,
  type Point,
  type Rect,
} from './layout.ts';

const box = (id: string, width = 200, height = 80): LayoutNode => ({ id, width, height });

// A small flow: a trigger, a branch that rejoins, and a side path with a label.
const nodes = [box('a'), box('b'), box('c'), box('d'), box('e', 160, 60)];
const edges: LayoutEdge[] = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c', label: { width: 120, height: 24 } },
  { from: 'b', to: 'd', label: { width: 140, height: 40 } },
  { from: 'c', to: 'e' },
  { from: 'd', to: 'e' },
];

/** Whether a point lies on a box's outline, give or take a pixel. */
const onBorder = (point: Point, rect: Point & { width: number; height: number }, slack = 1) => {
  const inside = (pad: number) =>
    point.x >= rect.x + pad &&
    point.x <= rect.x + rect.width - pad &&
    point.y >= rect.y + pad &&
    point.y <= rect.y + rect.height - pad;
  return inside(-slack) && !inside(slack);
};

const position = (positions: Map<string, Point>, id: string): Point => {
  const point = positions.get(id);
  if (!point) throw new Error(`no position for ${id}`);
  return point;
};

describe('layoutGraph', () => {
  it('places every node', () => {
    const { positions } = layoutGraph(nodes, edges, 'TB');
    expect([...positions.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    for (const point of positions.values()) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it('points every edge downward in TB and rightward in LR', () => {
    const tb = layoutGraph(nodes, edges, 'TB');
    const lr = layoutGraph(nodes, edges, 'LR');
    for (const edge of edges) {
      expect(position(tb.positions, edge.to).y).toBeGreaterThan(
        position(tb.positions, edge.from).y,
      );
      expect(position(lr.positions, edge.to).x).toBeGreaterThan(
        position(lr.positions, edge.from).x,
      );
    }
  });

  it('keeps nodes from overlapping', () => {
    const { positions } = layoutGraph(nodes, edges, 'TB');
    const rects = nodes.map((node) => ({ ...position(positions, node.id), ...node }));
    for (const [index, first] of rects.entries()) {
      for (const second of rects.slice(index + 1)) {
        const apart =
          first.x + first.width <= second.x ||
          second.x + second.width <= first.x ||
          first.y + first.height <= second.y ||
          second.y + second.height <= first.y;
        expect(apart, `${first.id} overlaps ${second.id}`).toBe(true);
      }
    }
  });

  it('returns top-left corners: the graph starts at 0, 0', () => {
    const { positions, width, height } = layoutGraph(nodes, edges, 'TB');
    const rects = nodes.map((node) => ({ ...position(positions, node.id), ...node }));
    expect(Math.min(...rects.map((rect) => rect.x))).toBeCloseTo(0);
    expect(Math.min(...rects.map((rect) => rect.y))).toBeCloseTo(0);
    expect(Math.max(...rects.map((rect) => rect.x + rect.width))).toBeLessThanOrEqual(width + 0.01);
    expect(Math.max(...rects.map((rect) => rect.y + rect.height))).toBeLessThanOrEqual(
      height + 0.01,
    );
  });

  it('is deterministic', () => {
    const first = layoutGraph(nodes, edges, 'TB');
    const second = layoutGraph(nodes, edges, 'TB');
    expect(second).toEqual(first);
  });

  it('routes each edge from the edge of its source box to the edge of its target box', () => {
    for (const direction of ['TB', 'LR'] as const) {
      const { positions, routes } = layoutGraph(nodes, edges, direction);
      expect(routes.size).toBe(edges.length);
      const rectOf = (id: string) => {
        const size = nodes.find((node) => node.id === id);
        return { ...position(positions, id), width: size?.width ?? 0, height: size?.height ?? 0 };
      };
      edges.forEach((edge, index) => {
        const route = routes.get(`${edge.from}->${edge.to}#${index}`);
        const first = route?.points[0];
        const last = route?.points[route.points.length - 1];
        if (!route || !first || !last) throw new Error(`no route for ${edge.from}->${edge.to}`);
        expect(route.points.length).toBeGreaterThanOrEqual(2);
        expect(onBorder(first, rectOf(edge.from)), `${edge.from} start (${direction})`).toBe(true);
        expect(onBorder(last, rectOf(edge.to)), `${edge.to} end (${direction})`).toBe(true);
        expect(Number.isFinite(route.labelAt.x) && Number.isFinite(route.labelAt.y)).toBe(true);
      });
    }
  });

  it('handles an empty graph', () => {
    expect(layoutGraph([], [], 'LR')).toEqual({
      positions: new Map(),
      routes: new Map(),
      width: 0,
      height: 0,
    });
  });

  it('keeps two edges between the same boxes apart, and skips edges to unknown nodes', () => {
    const { routes } = layoutGraph(
      [box('a'), box('b')],
      [
        { id: 'one', from: 'a', to: 'b' },
        { id: 'two', from: 'a', to: 'b' },
        { id: 'stray', from: 'a', to: 'nowhere' },
      ],
      'TB',
    );
    expect([...routes.keys()].sort()).toEqual(['one', 'two']);
  });
});

describe('line helpers', () => {
  it('finds the point halfway along a polyline', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(pointAlong(points, 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAlong(points, 0.25)).toEqual({ x: 5, y: 0 });
    expect(pointAlong([], 0.5)).toEqual({ x: 0, y: 0 });
  });

  it('draws a path through every route point', () => {
    expect(linePath([])).toBe('');
    expect(
      linePath([
        { x: 0, y: 0 },
        { x: 0, y: 50 },
      ]),
    ).toBe('M 0 0 L 0 50');
    const path = linePath([
      { x: 0, y: 0 },
      { x: 20, y: 40 },
      { x: 20, y: 80 },
    ]);
    // Two curves: one ending on the middle point (where a label sits), one on the last.
    expect(path.startsWith('M 0 0 C ')).toBe(true);
    expect(path).toContain(' 20 40 C ');
    expect(path.endsWith(' 20 80')).toBe(true);
  });

  it('sizes label chips: wider for longer text, taller once the text wraps', () => {
    const short = estimateLabelSize('next(AppError)');
    const long = estimateLabelSize('throw, rejected promise or next(err) (tests only today)');
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.width).toBeLessThanOrEqual(176);
    expect(long.height).toBeGreaterThan(short.height);
  });
});

describe('neighbourhood', () => {
  const lines = [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
    { id: 'cd', from: 'c', to: 'd' },
  ];

  it('is empty when nothing is selected', () => {
    expect(neighbourhood(undefined, lines)).toBeUndefined();
  });

  it('holds the selected node, the nodes one line away and those lines', () => {
    const lit = neighbourhood('b', lines);
    expect([...(lit?.nodes ?? [])].sort()).toEqual(['a', 'b', 'c']);
    expect([...(lit?.edges ?? [])].sort()).toEqual(['ab', 'bc']);
  });
});

describe('initialViewport', () => {
  const pane = { width: 800, height: 600 };
  const toScreen = (view: { x: number; y: number; zoom: number }, point: Point) => ({
    x: point.x * view.zoom + view.x,
    y: point.y * view.zoom + view.y,
  });

  it('fits and centres a graph that is readable when fitted', () => {
    const rects = [
      { x: 0, y: 0, width: 200, height: 80 },
      { x: 0, y: 160, width: 200, height: 80 },
    ];
    const view = initialViewport({ rects, pane, direction: 'TB' });
    expect(view.zoom).toBe(1); // never zooms in past 1
    const centre = toScreen(view, { x: 100, y: 120 });
    expect(centre.x).toBeCloseTo(400);
    expect(centre.y).toBeCloseTo(300);
  });

  it('opens a tall flow at the readable zoom, at its top, centred across', () => {
    // 300 wide, 2000 tall: fitting it would need zoom 0.27.
    const rects = [
      { x: 0, y: 0, width: 300, height: 80 },
      { x: 0, y: 1920, width: 300, height: 80 },
    ];
    const view = initialViewport({ rects, pane, direction: 'TB' });
    expect(view.zoom).toBe(READABLE_ZOOM);
    expect(toScreen(view, { x: 0, y: 0 }).y).toBeCloseTo(32);
    expect(toScreen(view, { x: 150, y: 0 }).x).toBeCloseTo(400);
  });

  it('opens a wide map at its left edge, centred on the first box when too tall', () => {
    const rects = [
      { x: 0, y: 900, width: 260, height: 100 }, // the first box, mid-height
      { x: 400, y: 0, width: 260, height: 100 },
      { x: 400, y: 1900, width: 260, height: 100 },
      { x: 2000, y: 900, width: 260, height: 100 },
    ];
    const view = initialViewport({ rects, pane, direction: 'LR' });
    expect(view.zoom).toBe(READABLE_ZOOM);
    expect(toScreen(view, { x: 0, y: 0 }).x).toBeCloseTo(32);
    expect(toScreen(view, { x: 130, y: 950 }).y).toBeCloseTo(300);
  });

  it('keeps the graph against the margin rather than showing empty space past its edge', () => {
    // The first box is at the very top of a tall LR graph: centring on it would show space above.
    const rects = [
      { x: 0, y: 0, width: 260, height: 100 },
      { x: 2000, y: 1900, width: 260, height: 100 },
    ];
    const view = initialViewport({ rects, pane, direction: 'LR' });
    expect(toScreen(view, { x: 0, y: 0 }).y).toBeCloseTo(32);
  });

  it('falls back to zoom 1 before the pane has a size', () => {
    expect(initialViewport({ rects: [], pane, direction: 'TB' })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(
      initialViewport({
        rects: [{ x: 0, y: 0, width: 10, height: 10 }],
        pane: { width: 0, height: 0 },
        direction: 'TB',
      }),
    ).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe('revealViewport', () => {
  const pane = { width: 800, height: 600 };
  const view = { x: 0, y: 0, zoom: 1 };

  it('leaves the view alone when the box is fully on screen', () => {
    expect(revealViewport(view, { x: 100, y: 100, width: 200, height: 80 }, pane)).toBeUndefined();
  });

  it('centres a box that is partly or fully off screen, keeping the zoom', () => {
    const moved = revealViewport(view, { x: 700, y: 100, width: 200, height: 80 }, pane);
    expect(moved).toEqual({ x: 400 - 800, y: 300 - 140, zoom: 1 });
  });

  // A mini-map in the bottom-right corner and zoom buttons in the bottom-left, as on screen.
  const miniMap = { x: 612, y: 462, width: 176, height: 112 };
  const buttons = { x: 15, y: 499, width: 28, height: 86 };

  it('moves a box that sits under an overlay, even though it is inside the pane', () => {
    const underMap = { x: 640, y: 480, width: 100, height: 60 };
    const moved = revealViewport(view, underMap, pane, { overlays: [miniMap, buttons] });
    // To the middle of the pane, which no overlay covers.
    expect(moved).toEqual({ x: 350 - 640, y: 270 - 480, zoom: 1 });
  });

  it('keeps a gap around overlays', () => {
    const justAbove = { x: 640, y: 380, width: 100, height: 78 }; // ends 4 px above the map
    expect(revealViewport(view, justAbove, pane, { overlays: [miniMap] })).toBeDefined();
    expect(revealViewport(view, justAbove, pane, { overlays: [miniMap], gap: 0 })).toBeUndefined();
  });

  it('leaves a box alone when the overlays are elsewhere', () => {
    const middle = { x: 300, y: 200, width: 200, height: 80 };
    expect(revealViewport(view, middle, pane, { overlays: [miniMap, buttons] })).toBeUndefined();
  });

  it('blocks only the rectangle an overlay covers, not a whole band across the pane', () => {
    const legend = { x: 560, y: 15, width: 224, height: 200 };
    const offScreen = { x: 900, y: 0, width: 100, height: 40 };
    const moved = revealViewport(view, offScreen, pane, { overlays: [legend, miniMap] });
    // The middle of the pane (350, 280) is clear of both, so that is where it goes.
    expect(moved).toEqual({ x: 350 - 900, y: 280, zoom: 1 });
  });

  it('measures the box at the current zoom', () => {
    const zoomed = { x: -100, y: 0, zoom: 0.5 };
    // At zoom 0.5 the box spans 250 to 350 on screen: visible.
    expect(revealViewport(zoomed, { x: 700, y: 0, width: 200, height: 80 }, pane)).toBeUndefined();
  });
});

describe('revealViewport on a phone, with the details sheet open', () => {
  // A 375 × 628 graph pane; the sheet covers its bottom 440 px, so 188 px stay visible.
  const pane = { width: 375, height: 628 };
  const insetBottom = 440;
  const view = { x: 0, y: 0, zoom: 1 };
  // The folded legend at the top-right, and the zoom buttons lifted above the sheet.
  const legend = { x: 280, y: 16, width: 80, height: 28 };
  const buttonColumn = { x: 15, y: 58, width: 30, height: 115 };
  const buttonRow = { x: 15, y: 145, width: 117, height: 28 };

  const screenRect = (moved: { x: number; y: number } | undefined, box: Rect) => ({
    x: box.x + (moved?.x ?? 0),
    y: box.y + (moved?.y ?? 0),
    width: box.width,
    height: box.height,
  });
  const clear = (a: Rect, b: Rect) =>
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

  it.each([
    ['a deep-linked step (screen top 240)', 240],
    ['a clicked step (screen top 282)', 282],
  ])('lifts %s above the sheet, clear of the legend and buttons', (_name, top) => {
    const box = { x: 80, y: top, width: 218, height: 64 };
    for (const buttons of [buttonColumn, buttonRow]) {
      const overlays = [legend, buttons];
      // Without the sheet it would count as in sight; with it, it has to move.
      expect(revealViewport(view, box, pane, { overlays })).toBeUndefined();
      const shown = screenRect(revealViewport(view, box, pane, { insetBottom, overlays }), box);
      expect(shown.y).toBeGreaterThanOrEqual(0);
      expect(shown.y + shown.height).toBeLessThanOrEqual(pane.height - insetBottom);
      expect(shown.x).toBeGreaterThanOrEqual(0);
      expect(shown.x + shown.width).toBeLessThanOrEqual(pane.width);
      expect(clear(shown, legend) && clear(shown, buttons)).toBe(true);
      // Centred in the 188 px left above the sheet: 62 to 126.
      expect(shown.y).toBeCloseTo(62);
    }
  });

  it('still keeps the box above the sheet when no spot clears every overlay', () => {
    const box = { x: 80, y: 240, width: 218, height: 64 };
    const everywhere = { x: 0, y: 0, width: 375, height: 188 };
    const shown = screenRect(
      revealViewport(view, box, pane, { insetBottom, overlays: [everywhere] }),
      box,
    );
    expect(shown.y).toBeGreaterThanOrEqual(0);
    expect(shown.y + shown.height).toBeLessThanOrEqual(188);
  });

  it('leaves a box alone that is already above the sheet and clear', () => {
    const box = { x: 80, y: 62, width: 218, height: 64 };
    expect(
      revealViewport(view, box, pane, { insetBottom, overlays: [legend, buttonRow] }),
    ).toBeUndefined();
  });
});

describe('boundsOf', () => {
  it('wraps every box', () => {
    expect(
      boundsOf([
        { x: 10, y: 20, width: 100, height: 50 },
        { x: -40, y: 200, width: 60, height: 60 },
      ]),
    ).toEqual({ x: -40, y: 20, width: 150, height: 240 });
    expect(boundsOf([])).toBeUndefined();
  });
});

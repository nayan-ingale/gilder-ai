import {
  Background,
  EdgeLabelRenderer,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useStore,
  useStoreApi,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type FitViewOptions,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  CANVAS_FILL,
  MARKER_SHAPE,
  MARKER_VIEWBOX,
  lineAppearance,
  type LineEmphasis,
  type LineStyle,
  type MarkerShape,
} from './edge-styles.ts';
import { PanelInsetContext } from '../layout/panel-inset.ts';
import {
  initialViewport,
  linePath,
  revealViewport,
  type LayoutDirection,
  type Point,
  type Rect,
} from './layout.ts';
import { MINIMAP_SHOWN_KEY, readFlag, writeFlag } from './view-settings.ts';
import './graph.css';

/**
 * The React Flow canvas both graphs share: the theme, the dotted background, the zoom, fit and
 * mini-map buttons, the mini-map itself and the one edge renderer. It moves like a canvas
 * tool: scrolling pans, pinching or Cmd/Ctrl + scroll zooms. Boxes can't be dragged or
 * connected; the graph is a map to read, so a click only selects. It fills its parent, which
 * sets the height.
 */

/**
 * The Fit button shows everything, however small, above the details sheet when one covers the
 * bottom of the graph.
 */
const fitOptions = (insetBottom: number): FitViewOptions => ({
  padding: insetBottom > 0 ? { x: 0.1, top: 0.1, bottom: `${insetBottom + 24}px` } : 0.1,
  maxZoom: 1,
});
const MINIMAP_SIZE = { width: 176, height: 112 };
/** Below this pane width the mini-map starts hidden: it would cover too much of the graph. */
const MINIMAP_MIN_PANE_WIDTH = 1000;

interface GraphCanvasProps<N extends Node, E extends Edge> {
  nodes: N[];
  edges: E[];
  /** Module-level maps, so React Flow doesn't remount every box on each render. */
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  /** Which way the graph reads: sets where the first view starts. */
  direction: LayoutDirection;
  /** Names the graph region for screen readers. */
  ariaLabel: string;
  /** Clicking the empty canvas, or pressing Escape, clears the selection. */
  onClearSelection: () => void;
  /** The selected box: kept in sight when it changes, the pane resizes or the mini-map opens. */
  focusId?: string;
  /** Overlays such as the legend, placed with React Flow's <Panel>. */
  children?: ReactNode;
}

export function GraphCanvas<N extends Node, E extends Edge>(props: GraphCanvasProps<N, E>) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

const rectOf = (node: Node): Rect => ({
  x: node.position.x,
  y: node.position.y,
  width: node.width ?? node.measured?.width ?? 0,
  height: node.height ?? node.measured?.height ?? 0,
});

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animation length for view moves: none when the reader asks for reduced motion. */
const motion = (ms: number): number => (prefersReducedMotion() ? 0 : ms);

/**
 * The panels drawn over the graph right now (legend, zoom buttons, mini-map, credit link), in
 * pane coordinates, measured when needed. The bring-into-view maths keeps boxes clear of them
 * where there is room; the details sheet on phones is a separate, hard limit (insetBottom).
 */
function overlayRects(region: HTMLElement | null): Rect[] {
  if (!region) return [];
  const origin = region.getBoundingClientRect();
  return Array.from(region.querySelectorAll('.react-flow__panel'), (panel) =>
    panel.getBoundingClientRect(),
  )
    .filter((box) => box.width > 0 && box.height > 0)
    .map((box) => ({
      x: box.left - origin.left,
      y: box.top - origin.top,
      width: box.width,
      height: box.height,
    }));
}

function Canvas<N extends Node, E extends Edge>({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  direction,
  ariaLabel,
  onClearSelection,
  focusId,
  children,
}: GraphCanvasProps<N, E>) {
  const { setViewport } = useReactFlow();
  const regionRef = useRef<HTMLDivElement>(null);
  // How much of the bottom a details sheet covers (phones); 0 when the panel sits beside.
  const insetBottom = useContext(PanelInsetContext).bottom;
  const reveal = useReveal(regionRef, insetBottom);
  const placed = useRef(false);
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  const zoomReady = useStore((state) => state.panZoom !== null);
  const nodesReady = useNodesInitialized();

  // The mini-map follows the reader's last choice; with none, it shows on wide panes only.
  const [minimapChoice, setMinimapChoice] = useState(() => readFlag(MINIMAP_SHOWN_KEY));
  const showMinimap = minimapChoice ?? paneWidth >= MINIMAP_MIN_PANE_WIDTH;
  const toggleMinimap = () => {
    setMinimapChoice(!showMinimap);
    writeFlag(MINIMAP_SHOWN_KEY, !showMinimap);
  };

  const lastLayout = useRef({
    width: paneWidth,
    height: paneHeight,
    minimap: showMinimap,
    inset: insetBottom,
  });

  // The first view: fitted if that is readable, otherwise at a readable zoom where the graph
  // starts, with the selected box (from the URL) in sight. Once per graph: a new graph remounts
  // this canvas. The graph stays hidden until then, so it doesn't jump.
  useEffect(() => {
    if (placed.current || !nodesReady || !zoomReady || paneWidth <= 0 || paneHeight <= 0) return;
    placed.current = true;
    const pane = { width: paneWidth, height: paneHeight };
    lastLayout.current = { ...pane, minimap: showMinimap, inset: insetBottom };
    // The graph opens in the part of the pane a details sheet leaves visible.
    const visible = { width: paneWidth, height: Math.max(paneHeight - insetBottom, 1) };
    const start = initialViewport({ rects: nodes.map(rectOf), pane: visible, direction });
    const selected = nodes.find((node) => node.id === focusId);
    const overlays = overlayRects(regionRef.current);
    void setViewport(
      (selected && revealViewport(start, rectOf(selected), pane, { insetBottom, overlays })) ??
        start,
    );
    regionRef.current?.setAttribute('data-placed', 'true');
  }, [
    nodesReady,
    zoomReady,
    paneWidth,
    paneHeight,
    showMinimap,
    insetBottom,
    nodes,
    direction,
    focusId,
    setViewport,
  ]);

  // When the pane changes size (a side panel opens or folds), the mini-map appears or a details
  // sheet covers more or less of the graph, keep the selected box in sight.
  useEffect(() => {
    const before = lastLayout.current;
    lastLayout.current = {
      width: paneWidth,
      height: paneHeight,
      minimap: showMinimap,
      inset: insetBottom,
    };
    if (!placed.current || focusId === undefined) return;
    if (before.width !== paneWidth || before.height !== paneHeight) reveal(focusId, false);
    else if (before.minimap !== showMinimap || before.inset !== insetBottom) reveal(focusId, true);
  }, [paneWidth, paneHeight, showMinimap, insetBottom, focusId, reveal]);

  // When the selection changes (a click elsewhere, the URL, Back), bring the box into sight.
  const previousFocus = useRef(focusId);
  useEffect(() => {
    if (focusId === previousFocus.current) return;
    previousFocus.current = focusId;
    if (placed.current && focusId !== undefined) reveal(focusId, true);
  }, [focusId, reveal]);

  // Escape and a click on the empty canvas clear the selection, only when there is one. Escape
  // is marked handled, so the page's own Escape handling doesn't clear it a second time.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || focusId === undefined) return;
    event.preventDefault();
    onClearSelection();
  };
  const onPaneClick = () => {
    if (focusId !== undefined) onClearSelection();
  };

  // Tabbing to a box that is off screen pans to it, so keyboard users can see where they are.
  // Mouse focus is left alone: it would fight a drag that starts on a box.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.matches(':focus-visible')) return;
    const nodeId = event.target.closest('.react-flow__node')?.getAttribute('data-id');
    if (nodeId) reveal(nodeId, true);
  };

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label={ariaLabel}
      className="gx-graph size-full"
      // Bottom panels (zoom buttons, mini-map) sit above a details sheet, not under it.
      style={{ '--gx-inset-bottom': `${insetBottom}px` } as CSSProperties}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <ReactFlow<N, E>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        minZoom={0.1}
        maxZoom={2}
        panOnScroll
        panOnScrollSpeed={1}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        disableKeyboardA11y
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        onPaneClick={onPaneClick}
      >
        <Background gap={20} size={1} />
        <Panel position="bottom-left">
          <ZoomControls
            minimapShown={showMinimap}
            onToggleMinimap={toggleMinimap}
            insetBottom={insetBottom}
          />
        </Panel>
        {showMinimap ? (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            ariaLabel="Overview of the whole graph. Drag in it to move the view."
            nodeColor={(node) =>
              node.id === focusId ? 'var(--color-accent)' : 'var(--color-line-strong)'
            }
            nodeBorderRadius={8}
            maskStrokeColor="var(--color-fg-subtle)"
            maskStrokeWidth={1}
            style={MINIMAP_SIZE}
          />
        ) : null}
        {children}
      </ReactFlow>
    </div>
  );
}

/**
 * Moves the view, keeping the zoom, so a box is fully in sight: inside the pane and clear of
 * the panels drawn over it. Does nothing if it already is. Animated for clicks and keyboard
 * moves, instant while the pane is resizing.
 */
function useReveal(
  region: RefObject<HTMLElement | null>,
  insetBottom: number,
): (nodeId: string, animate: boolean) => void {
  const { getInternalNode, getViewport, setViewport } = useReactFlow();
  const store = useStoreApi();

  return useCallback(
    (nodeId: string, animate: boolean) => {
      const node = getInternalNode(nodeId);
      if (!node) return;
      const { width, height } = store.getState();
      const rect = {
        ...node.internals.positionAbsolute,
        width: node.measured.width ?? node.width ?? 0,
        height: node.measured.height ?? node.height ?? 0,
      };
      const pane = { width, height };
      const overlays = overlayRects(region.current);
      const next = revealViewport(getViewport(), rect, pane, { insetBottom, overlays });
      if (next) void setViewport(next, { duration: animate ? motion(250) : 0 });
    },
    [getInternalNode, getViewport, setViewport, store, region, insetBottom],
  );
}

interface ZoomControlsProps {
  minimapShown: boolean;
  onToggleMinimap: () => void;
  insetBottom: number;
}

function ZoomControls({ minimapShown, onToggleMinimap, insetBottom }: ZoomControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const button =
    'inline-flex size-7 items-center justify-center text-fg-muted transition-colors duration-150 hover:bg-hover hover:text-fg aria-pressed:bg-raised aria-pressed:text-fg';
  const minimapHint = minimapShown ? 'Hide mini-map' : 'Show mini-map';
  // With a details sheet over the bottom (phones), the strip of graph left above it is short,
  // so the buttons lie in one row there instead of a column.
  const layout = insetBottom > 0 ? 'flex-row divide-x' : 'flex-col divide-y';
  return (
    <div
      className={`flex ${layout} divide-line overflow-hidden rounded-md border border-line bg-surface`}
    >
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        className={button}
        onClick={() => void zoomIn({ duration: motion(150) })}
      >
        <Icon path="M7 2.5v9M2.5 7h9" />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        className={button}
        onClick={() => void zoomOut({ duration: motion(150) })}
      >
        <Icon path="M2.5 7h9" />
      </button>
      <button
        type="button"
        aria-label="Fit to screen"
        title="Fit to screen"
        className={button}
        onClick={() => void fitView({ ...fitOptions(insetBottom), duration: motion(200) })}
      >
        <Icon path="M2 5V2h3M9 2h3v3M12 9v3H9M5 12H2V9" />
      </button>
      <button
        type="button"
        aria-label="Mini-map"
        aria-pressed={minimapShown}
        title={minimapHint}
        className={button}
        onClick={onToggleMinimap}
      >
        {/* A small map in the corner of a frame. */}
        <Icon path="M2 3h10v8H2zM7 7.25h3.25v2H7z" />
      </button>
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 14 14" className="size-3.5">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Lines

export type GraphEdgeData = {
  /** The route from the layout, in graph coordinates. */
  points: Point[];
  /** Where the chip sits. */
  labelAt: Point;
  line: LineStyle;
  emphasis: LineEmphasis;
  /** Short text shown on the line, if any. */
  chip?: string;
  /** The full description, shown on hover. */
  title: string;
};

export type GraphLine = Edge<GraphEdgeData, 'graph'>;

/**
 * Draws a line along the layout's route (not React Flow's handle-to-handle curve), so lines
 * bend around boxes and land where dagre left room for their labels.
 */
export function GraphEdge({ data }: EdgeProps<GraphLine>) {
  const markerId = `gx-${useId().replace(/[^\w-]/g, '')}`;
  if (!data) return null;
  const { line, emphasis } = data;
  const { stroke, width, opacity } = lineAppearance(line, emphasis);
  const path = linePath(data.points);
  const endId = `${markerId}-end`;
  const startId = `${markerId}-start`;
  const markerEnd = line.markerEnd ? `url(#${endId})` : undefined;
  const markerStart = line.markerStart ? `url(#${startId})` : undefined;

  return (
    <>
      <defs>
        {line.markerEnd ? <LineMarker id={endId} shape={line.markerEnd} color={stroke} /> : null}
        {line.markerStart ? (
          <LineMarker id={startId} shape={line.markerStart} color={stroke} />
        ) : null}
      </defs>
      <g className="gx-edge" style={{ opacity }}>
        <path d={path} className="gx-edge-hit">
          <title>{data.title}</title>
        </path>
        <path
          d={path}
          fill="none"
          style={{ stroke }}
          strokeWidth={width}
          strokeDasharray={line.dash}
          strokeLinecap={line.roundCaps ? 'round' : 'butt'}
          markerEnd={line.double ? undefined : markerEnd}
          markerStart={line.double ? undefined : markerStart}
        />
        {line.double ? (
          // The hollow core of a double line; it carries the markers so they sit on top.
          <path
            d={path}
            fill="none"
            style={{ stroke: CANVAS_FILL }}
            strokeWidth={width - 3}
            markerEnd={markerEnd}
            markerStart={markerStart}
          />
        ) : null}
      </g>
      {data.chip ? (
        <EdgeLabelRenderer>
          <div
            title={data.title}
            className={`gx-edge-chip pointer-events-auto absolute max-w-44 rounded border bg-canvas px-1.5 py-0.5 text-center text-[11px] leading-4 ${emphasis === 'dimmed' ? 'text-fg-subtle' : 'text-fg-muted'}`}
            style={{
              transform: `translate(-50%, -50%) translate(${data.labelAt.x}px, ${data.labelAt.y}px)`,
              // A faded label keeps full-strength subtle text, so it stays readable.
              borderColor: emphasis === 'dimmed' ? 'var(--color-line)' : stroke,
            }}
          >
            {data.chip}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

/** One marker, in the line's colour. Also used by the legend, so both draw the same shapes. */
export function LineMarker({
  id,
  shape,
  color,
}: {
  id: string;
  shape: MarkerShape;
  color: string;
}) {
  const { path, fill, strokeWidth } = MARKER_SHAPE[shape];
  const box = MARKER_VIEWBOX;
  return (
    <marker
      id={id}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      markerWidth={box.width}
      markerHeight={box.height}
      markerUnits="userSpaceOnUse"
      refX={0}
      refY={0}
      orient="auto-start-reverse"
    >
      <path
        d={path}
        style={{
          stroke: color,
          fill: fill === 'line' ? color : fill === 'canvas' ? CANVAS_FILL : 'none',
        }}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </marker>
  );
}

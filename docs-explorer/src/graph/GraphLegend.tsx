import { Panel } from '@xyflow/react';
import { useId, useState } from 'react';
import { CANVAS_FILL, navigationHint, type LegendItem, type LegendSection } from './edge-styles.ts';
import { LineMarker } from './GraphCanvas.tsx';
import { LEGEND_OPEN_KEY, readFlag, writeFlag } from './view-settings.ts';

/**
 * A small key in the top-right corner of a graph. It lists only the line and box styles that
 * appear in the graph on screen, drawn with the same styles as the graph itself, and how to
 * move around. It starts folded to its button, so it never covers the first boxes, and
 * remembers whether the reader last left it open. It sits on the page background, like the
 * lines, so hollow shapes look the same in both.
 */

interface GraphLegendProps {
  sections: LegendSection[];
}

const HINT =
  typeof window === 'undefined'
    ? navigationHint({ mac: false, touchOnly: false })
    : navigationHint({
        mac: /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent),
        touchOnly: window.matchMedia('(hover: none) and (pointer: coarse)').matches,
      });

export function GraphLegend({ sections }: GraphLegendProps) {
  const [open, setOpen] = useState(() => readFlag(LEGEND_OPEN_KEY) ?? false);
  const contentId = useId();
  const toggle = () => {
    setOpen(!open);
    writeFlag(LEGEND_OPEN_KEY, !open);
  };
  if (sections.length === 0) return null;

  return (
    <Panel position="top-right">
      <div className="max-w-56 rounded-md border border-line bg-canvas text-xs text-fg-muted">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          onClick={toggle}
          className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left font-medium text-fg hover:bg-hover"
        >
          Legend
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className={`size-3 text-fg-subtle transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          >
            <path
              d="M3 4.5 6 7.5l3-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open ? (
          <div id={contentId} className="flex flex-col gap-2.5 border-t border-line px-2.5 py-2">
            {sections.map((section, index) => (
              <div key={section.title}>
                <p
                  id={`${contentId}-${index}`}
                  className="mb-1 text-[11px] font-medium tracking-wide text-fg-subtle uppercase"
                >
                  {section.title}
                </p>
                <ul aria-labelledby={`${contentId}-${index}`} className="flex flex-col gap-1">
                  {section.items.map((item) => (
                    <li key={item.key} className="flex items-center gap-2">
                      <Sample item={item} />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="border-t border-line pt-2 text-[11px] text-fg-subtle">{HINT}</p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Sample({ item }: { item: LegendItem }) {
  const markerId = `gx-legend-${useId().replace(/[^\w-]/g, '')}`;

  if (item.type === 'box') {
    const look =
      item.look === 'planned'
        ? 'border-dashed border-line-strong bg-raised'
        : 'border-line/60 bg-canvas'; // faded like a context box in the graph
    return <span aria-hidden="true" className={`h-3 w-7 shrink-0 rounded-sm border ${look}`} />;
  }

  const { line } = item;
  const y = 6;
  return (
    <svg aria-hidden="true" viewBox="0 0 40 12" className="h-3 w-10 shrink-0 overflow-visible">
      <defs>
        {line.markerEnd ? (
          <LineMarker id={`${markerId}-end`} shape={line.markerEnd} color={line.stroke} />
        ) : null}
        {line.markerStart ? (
          <LineMarker id={`${markerId}-start`} shape={line.markerStart} color={line.stroke} />
        ) : null}
      </defs>
      <g style={{ opacity: line.opacity }}>
        <path
          d={`M 1 ${y} L 38 ${y}`}
          fill="none"
          style={{ stroke: line.stroke }}
          strokeWidth={line.width}
          strokeDasharray={line.dash}
          strokeLinecap={line.roundCaps ? 'round' : 'butt'}
          markerEnd={!line.double && line.markerEnd ? `url(#${markerId}-end)` : undefined}
          markerStart={!line.double && line.markerStart ? `url(#${markerId}-start)` : undefined}
        />
        {line.double ? (
          <path
            d={`M 1 ${y} L 38 ${y}`}
            fill="none"
            style={{ stroke: CANVAS_FILL }}
            strokeWidth={line.width - 3}
            markerEnd={line.markerEnd ? `url(#${markerId}-end)` : undefined}
          />
        ) : null}
      </g>
    </svg>
  );
}

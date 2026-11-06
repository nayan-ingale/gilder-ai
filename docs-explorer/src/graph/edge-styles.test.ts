import { describe, expect, it } from 'vitest';
import type { ArchComponent, ArchLink, Status } from '../data/schema.ts';
import {
  FLOW_LINE_STYLE,
  WALKED_STROKE,
  architectureLegend,
  flowLegend,
  lineAppearance,
  linkLineStyle,
  navigationHint,
} from './edge-styles.ts';

const component = (id: string, status: Status = 'verified'): ArchComponent => ({
  id,
  name: id,
  kind: 'app',
  status,
  summary: id,
  responsibilities: [],
});

const link = (from: string, to: string, status: Status, kind: ArchLink['kind'] = 'http') => ({
  from,
  to,
  kind,
  label: `${from} to ${to}`,
  status,
});

describe('line styles', () => {
  it('tells every flow line kind apart by dash or shape, not colour alone', () => {
    const looks = Object.values(FLOW_LINE_STYLE).map((line) =>
      [line.dash, line.double, line.markerStart, line.markerEnd].join('|'),
    );
    expect(new Set(looks).size).toBe(looks.length);
  });

  it('draws a walked line in the accent colour, thicker, keeping its own dash', () => {
    for (const line of Object.values(FLOW_LINE_STYLE)) {
      const walked = lineAppearance(line, 'walked');
      expect(walked.stroke).toBe(WALKED_STROKE);
      expect(walked.width).toBeGreaterThan(lineAppearance(line, 'highlight').width);
      expect(walked.opacity).toBe(1);
    }
  });

  it('dashes and fades planned links', () => {
    const planned = linkLineStyle('http', 'planned');
    expect(planned.dash).toBeDefined();
    expect(planned.opacity).toBeLessThan(1);
    expect(linkLineStyle('http', 'verified').dash).toBeUndefined();
  });

  it('gives every link status its own dash pattern', () => {
    const statuses: Status[] = [
      'verified',
      'partial',
      'inferred',
      'not-wired',
      'planned',
      'unknown',
    ];
    const dashes = statuses.map((status) => linkLineStyle('http', status).dash ?? 'solid');
    expect(new Set(dashes).size).toBe(statuses.length);
  });
});

describe('legends', () => {
  it('lists only the flow line kinds in the graph', () => {
    const [section] = flowLegend(new Set(['next', 'error']));
    expect(section?.items.map((item) => item.label)).toEqual(['Next step', 'Error path']);
    expect(flowLegend(new Set())).toEqual([]);
  });

  it('adds the walked path only while a walkthrough shows one', () => {
    const [walking] = flowLegend(new Set(['next', 'branch']), { walked: true });
    expect(walking?.items.map((item) => item.label)).toEqual([
      'Next step',
      'Condition',
      'Walked path',
    ]);
    const [browsing] = flowLegend(new Set(['next', 'branch']), { walked: false });
    expect(browsing?.items.map((item) => item.label)).not.toContain('Walked path');
  });

  it('explains a dashed status even when it is the only one in view', () => {
    const titles = architectureLegend(
      [component('a'), component('b', 'planned')],
      [link('a', 'b', 'planned')],
      new Set(),
    ).map((section) => section.title);
    expect(titles).toEqual(['Connections', 'Status', 'Boxes']);
  });

  it('leaves the status rows out when every line is plain solid', () => {
    const titles = architectureLegend(
      [component('a'), component('b')],
      [link('a', 'b', 'verified')],
      new Set(['b']),
    ).map((section) => section.title);
    expect(titles).toEqual(['Connections', 'Boxes']);
  });

  it('lists partly verified and inferred links with their own rows', () => {
    const status = architectureLegend(
      [component('a'), component('b'), component('c')],
      [link('a', 'b', 'verified'), link('a', 'c', 'partial'), link('b', 'c', 'inferred')],
      new Set(),
    ).find((section) => section.title === 'Status');
    expect(status?.items.map((item) => item.label)).toEqual([
      'Verified',
      'Partly verified',
      'Inferred',
    ]);
  });
});

describe('navigationHint', () => {
  it('names the zoom key for the platform, and drops the keys on touch screens', () => {
    expect(navigationHint({ mac: true, touchOnly: false })).toBe(
      'Scroll to move · Pinch or ⌘ + scroll to zoom',
    );
    expect(navigationHint({ mac: false, touchOnly: false })).toBe(
      'Scroll to move · Pinch or Ctrl + scroll to zoom',
    );
    expect(navigationHint({ mac: true, touchOnly: true })).toBe('Drag to move · Pinch to zoom');
  });
});

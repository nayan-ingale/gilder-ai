import { describe, expect, it } from 'vitest';
import { fillDays, niceMax, tooltipPosition } from './daily-chart';

describe('fillDays', () => {
  it('returns every day in the window, oldest first, with 0 for quiet days', () => {
    const days = fillDays(
      [
        { date: '2026-11-07', credits: 5 },
        { date: '2026-11-09', credits: 2 },
      ],
      4,
      new Date('2026-11-09T15:00:00Z'),
    );

    expect(days).toEqual([
      { date: '2026-11-06', credits: 0 },
      { date: '2026-11-07', credits: 5 },
      { date: '2026-11-08', credits: 0 },
      { date: '2026-11-09', credits: 2 },
    ]);
  });
});

describe('fillDays across time zones', () => {
  it("ends on the viewer's today, not the UTC one", () => {
    // 21:30 UTC on 8 Nov is already 9 Nov in India.
    const lateEvening = new Date('2026-11-08T21:30:00Z');

    expect(fillDays([], 2, lateEvening, 'Asia/Kolkata').map((day) => day.date)).toEqual([
      '2026-11-08',
      '2026-11-09',
    ]);
    expect(fillDays([], 1, lateEvening, 'UTC')[0]?.date).toBe('2026-11-08');
  });
});

describe('niceMax', () => {
  it('rounds the axis top up to 1, 2 or 5 times a power of ten', () => {
    expect([0, 1, 3, 7, 12, 99, 101, 420].map(niceMax)).toEqual([1, 1, 5, 10, 20, 100, 200, 500]);
  });
});

describe('tooltipPosition', () => {
  it('centres the tooltip, but keeps it inside the chart at the edges', () => {
    expect(tooltipPosition(15, 30).transform).toBe('translate(-50%, -100%)');
    expect(tooltipPosition(29, 30).transform).toBe('translate(-100%, -100%)');
    expect(tooltipPosition(0, 30).transform).toBe('translate(0%, -100%)');
  });
});

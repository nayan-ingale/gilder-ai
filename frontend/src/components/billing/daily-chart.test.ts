import { describe, expect, it } from 'vitest';
import { axisTicks, dateTick, fillDays, formatDayRange, tooltipPosition } from './daily-chart';

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

describe('axisTicks', () => {
  it('steps by 1, 2 or 5 times a power of ten, about three lines, up to the largest value', () => {
    expect(axisTicks(22)).toEqual([0, 10, 20, 30]);
    expect(axisTicks(5)).toEqual([0, 2, 4, 6]);
    expect(axisTicks(100)).toEqual([0, 50, 100]);
    expect(axisTicks(420)).toEqual([0, 200, 400, 600]);
  });

  it('never steps below one credit, even with no usage', () => {
    expect(axisTicks(0)).toEqual([0, 1]);
    expect(axisTicks(1)).toEqual([0, 1]);
    expect(axisTicks(3)).toEqual([0, 1, 2, 3]);
  });
});

describe('formatDayRange', () => {
  it('names the first and last day, with the year once, or twice across a new year', () => {
    expect(formatDayRange('2026-10-06', '2026-11-04')).toBe('Oct 6 – Nov 4, 2026');
    expect(formatDayRange('2025-12-20', '2026-01-18')).toBe('Dec 20, 2025 – Jan 18, 2026');
  });
});

describe('tooltipPosition', () => {
  it('centres the tooltip, but keeps it inside the chart at the edges', () => {
    expect(tooltipPosition(2, 5)).toEqual({ left: '50%', transform: 'translateX(-50%)' });
    expect(tooltipPosition(29, 30).transform).toBe('translateX(-100%)');
    expect(tooltipPosition(0, 30).transform).toBe('translateX(0%)');
  });
});

describe('dateTick', () => {
  const ticked = (count: number, wide: boolean) =>
    Array.from({ length: count }, (_, index) => index).filter((index) => {
      const tick = dateTick(index, count);
      return tick === 'always' || (wide && tick === 'wide');
    });

  it('dates every day of a week and one day a week of a month', () => {
    expect(ticked(7, false)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ticked(30, false)).toEqual([0, 7, 14, 21, 28]);
  });

  it('dates 90 days every two weeks, and every four on a phone', () => {
    expect(ticked(90, true)).toEqual([0, 14, 28, 42, 56, 70, 84]);
    expect(ticked(90, false)).toEqual([0, 28, 56, 84]);
  });
});

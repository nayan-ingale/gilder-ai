'use client';

import { type KeyboardEvent, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * Credits used per day, as columns: one series in one colour, so no legend (the heading names
 * it). Columns are capped at 24px with a 2px gap and a rounded top, from one baseline, over
 * hairline gridlines at clean values. Hovering, focusing or tapping a day shows its value; the
 * same numbers are in a table, hidden for screen readers or shown when chosen.
 */

export interface DayValue {
  date: string;
  credits: number;
}

/** Room above the plot for the tooltip, the plot's height, and the axis labels' width. */
const HEADROOM = 34;
const PLOT_HEIGHT = 180;
const TOOLTIP_HEIGHT = 52;

// The dates are calendar days already (YYYY-MM-DD); labelling them in UTC keeps the day as is.
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const dayWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const label = (date: string) => dayLabel.format(toDate(date));

/**
 * Every day in the window, oldest first, with 0 for days without usage. Days are counted in
 * `timeZone`, the zone the server grouped by, so the last day is the viewer's today.
 */
export function fillDays(
  byDay: readonly DayValue[],
  days: number,
  today = new Date(),
  timeZone = 'UTC',
): DayValue[] {
  const known = new Map(byDay.map((day) => [day.date, day.credits]));
  const localToday = new Intl.DateTimeFormat('en-CA', { timeZone }).format(today);
  const end = Date.parse(`${localToday}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return { date, credits: known.get(date) ?? 0 };
  });
}

/** "Oct 6 – Nov 4, 2026", with the first year too when the window crosses a new year. */
export function formatDayRange(first: string, last: string): string {
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const start = (sameYear ? dayLabel : dayWithYear).format(toDate(first));
  return `${start} – ${dayWithYear.format(toDate(last))}`;
}

/**
 * The gridline values, from 0: a clean step (1, 2 or 5 times a power of ten, never below 1, as
 * credits are whole) giving about three lines, the top one at or above the largest value.
 */
export function axisTicks(max: number): number[] {
  const rough = Math.max(1, max / 3);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((multiple) => multiple * power >= rough) ?? 10) * power;
  const count = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

/**
 * Where the tooltip sits across the plot: centred over its day, but kept inside the chart near
 * either edge, so its text is never cut off.
 */
export function tooltipPosition(index: number, count: number): { left: string; transform: string } {
  const centre = (index + 0.5) / count;
  const shift = centre > 0.8 ? '-100%' : centre < 0.2 ? '0%' : '-50%';
  return { left: `${centre * 100}%`, transform: `translateX(${shift})` };
}

/**
 * Whether a day gets its date under the axis: every day for a week, one a week for a month. For
 * 90 days, weekly dates would touch, so one every two weeks, and on a phone one every four
 * ('wide': on wider screens only).
 */
export function dateTick(index: number, count: number): 'always' | 'wide' | null {
  if (count <= 7) {
    return 'always';
  }
  if (count <= 31) {
    return index % 7 === 0 ? 'always' : null;
  }
  if (index % 14 !== 0) {
    return null;
  }
  return index % 28 === 0 ? 'always' : 'wide';
}

export function DailyChart({ days }: { days: readonly DayValue[] }) {
  // The day under the pointer or focus, and the one the keyboard is on (today to start with).
  const [active, setActive] = useState<number | null>(null);
  const [cursor, setCursor] = useState(days.length - 1);
  const bars = useRef<(HTMLButtonElement | null)[]>([]);
  const ticks = axisTicks(Math.max(...days.map((day) => day.credits)));
  const top = ticks.at(-1) ?? 1;
  const total = days.reduce((sum, day) => sum + day.credits, 0);
  const heightOf = (credits: number) => Math.round((credits / top) * PLOT_HEIGHT);
  const shown = active === null ? undefined : days[active];
  const focusIndex = Math.min(cursor, days.length - 1);

  function moveTo(index: number) {
    const next = Math.max(0, Math.min(days.length - 1, index));
    setCursor(next);
    setActive(next);
    bars.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: days.length - 1,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      moveTo(next);
    }
  }

  return (
    <figure className="relative m-0" style={{ paddingTop: HEADROOM }}>
      {ticks.map((tick) => {
        const y = HEADROOM + PLOT_HEIGHT - heightOf(tick);
        return (
          <div key={tick} aria-hidden="true">
            <div className="absolute right-0 left-9 border-t border-line" style={{ top: y }} />
            <span
              className="absolute left-0 w-7 text-right text-xs text-fg-muted tabular-nums"
              style={{ top: y - 8 }}
            >
              {tick.toLocaleString('en-IN')}
            </span>
          </div>
        );
      })}
      <div
        role="group"
        aria-label={`Credits used per day over ${days.length} days: ${total} in total. Use the arrow keys to move between days.`}
        className="relative ml-9 flex items-end gap-0.5"
        style={{ height: PLOT_HEIGHT }}
        onMouseLeave={() => setActive(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setActive(null);
          }
        }}
      >
        {days.map((day, index) => (
          <button
            key={day.date}
            ref={(element) => {
              bars.current[index] = element;
            }}
            type="button"
            tabIndex={index === focusIndex ? 0 : -1}
            aria-label={`${label(day.date)}: ${day.credits} ${day.credits === 1 ? 'credit' : 'credits'}`}
            className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-offset-0"
            onMouseEnter={() => setActive(index)}
            onFocus={() => {
              setCursor(index);
              setActive(index);
            }}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span
              className="block w-full max-w-6 rounded-t bg-chart-bar transition-opacity"
              style={{
                height: heightOf(day.credits),
                opacity: active === null || active === index ? 1 : 0.45,
              }}
            />
          </button>
        ))}
        {shown && active !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute flex flex-col gap-0.5 rounded-sm border border-line bg-raised px-3 py-2 whitespace-nowrap shadow-raised"
            style={{
              ...tooltipPosition(active, days.length),
              bottom: Math.min(
                heightOf(shown.credits) + 8,
                PLOT_HEIGHT + HEADROOM - TOOLTIP_HEIGHT,
              ),
            }}
          >
            <span className="text-[12.5px] font-semibold text-fg">{label(shown.date)}</span>
            <span className="text-[12.5px] text-fg-muted">
              {shown.credits} {shown.credits === 1 ? 'credit' : 'credits'}
            </span>
          </div>
        ) : null}
      </div>
      <div aria-hidden="true" className="ml-9 flex gap-0.5 pt-2">
        {days.map((day, index) => {
          const tick = dateTick(index, days.length);
          return (
            <span
              key={day.date}
              className={cn(
                'min-w-0 flex-1 overflow-visible text-xs whitespace-nowrap text-fg-muted',
                tick === 'wide' && 'max-sm:invisible',
              )}
            >
              {tick ? label(day.date) : ''}
            </span>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>Credits used per day</caption>
        <DayRows days={days} />
      </table>
    </figure>
  );
}

function DayRows({ days, cell = '' }: { days: readonly DayValue[]; cell?: string }) {
  return (
    <>
      <thead>
        <tr>
          <th scope="col" className={cn(cell, 'text-left')}>
            Day
          </th>
          <th scope="col" className={cn(cell, 'text-right')}>
            Credits
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.date}>
            <td>{label(day.date)}</td>
            <td>{day.credits}</td>
          </tr>
        ))}
      </tbody>
    </>
  );
}

/** The same days as a visible table, for reading exact numbers (the chart's Table view). */
export function DayTable({ days }: { days: readonly DayValue[] }) {
  return (
    // Focusable, so keyboard users can scroll it.
    <div
      role="region"
      aria-label="Credits used per day, as a table"
      tabIndex={0}
      className="max-h-[236px] overflow-auto rounded-sm border border-line"
    >
      <table className="w-full border-collapse text-[13.5px] text-fg [&_td]:border-b [&_td]:border-line [&_td]:px-3.5 [&_td]:py-[7px] [&_td:last-child]:text-right [&_td:last-child]:tabular-nums">
        <caption className="sr-only">Credits used per day</caption>
        <DayRows
          days={days}
          cell="sticky top-0 border-b border-line bg-surface px-3.5 py-2 text-[12.5px] font-medium text-fg-muted"
        />
      </table>
    </div>
  );
}

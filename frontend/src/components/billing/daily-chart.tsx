'use client';

import { useState } from 'react';

/**
 * Credits used per day, as columns: one series in one colour, so no legend (the heading names
 * it). Columns are capped at 24px with a 2px gap and a rounded top, from one baseline. Hovering
 * or focusing a day shows its value; the same numbers are in a table for screen readers.
 */

export interface DayValue {
  date: string;
  credits: number;
}

// The dates are calendar days already (YYYY-MM-DD); labelling them in UTC keeps the day as is.
const dayLabel = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

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

/** A clean top for the axis: 1, 2 or 5 times a power of ten, at or above the largest value. */
export function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => multiple * power >= value) ?? 10;
  return step * power;
}

/**
 * Where the tooltip sits: centred over its day, but kept inside the chart near either edge, so
 * its text is never cut off.
 */
export function tooltipPosition(index: number, count: number): { left: string; transform: string } {
  const centre = (index + 0.5) / count;
  const shift = centre > 0.8 ? '-100%' : centre < 0.2 ? '0%' : '-50%';
  return { left: `${centre * 100}%`, transform: `translate(${shift}, -100%)` };
}

export function DailyChart({ days }: { days: readonly DayValue[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...days.map((day) => day.credits)));
  const total = days.reduce((sum, day) => sum + day.credits, 0);
  const shown = active === null ? undefined : days[active];
  const label = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));

  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={`Credits used per day over ${days.length} days: ${total} in total.`}
        className="relative"
      >
        <div className="flex h-40 items-stretch gap-2">
          <div
            aria-hidden="true"
            className="flex w-8 shrink-0 flex-col justify-between text-right text-xs text-fg-subtle tabular-nums"
          >
            <span>{top.toLocaleString('en-IN')}</span>
            <span>0</span>
          </div>
          <div
            className="relative flex flex-1 items-end gap-0.5 border-b border-line"
            onMouseLeave={() => setActive(null)}
          >
            {days.map((day, index) => (
              <div
                key={day.date}
                aria-hidden="true"
                className="flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setActive(index)}
              >
                <div
                  className="w-full max-w-6 rounded-t bg-chart-bar transition-opacity"
                  style={{
                    height: day.credits > 0 ? `${Math.max((day.credits / top) * 100, 2)}%` : '0',
                    opacity: active === null || active === index ? 1 : 0.45,
                  }}
                />
              </div>
            ))}
            {shown ? (
              <div
                role="status"
                className="pointer-events-none absolute -top-2 -translate-y-full rounded-md border border-line bg-raised px-2 py-1 text-xs whitespace-nowrap text-fg shadow-sm"
                style={tooltipPosition(active ?? 0, days.length)}
              >
                <span className="text-fg-muted">{label(shown.date)}</span> ·{' '}
                <span className="font-medium tabular-nums">{shown.credits}</span>{' '}
                {shown.credits === 1 ? 'credit' : 'credits'}
              </div>
            ) : null}
          </div>
        </div>
        <div aria-hidden="true" className="mt-1 flex justify-between pl-10 text-xs text-fg-subtle">
          <span>{days[0] ? label(days[0].date) : ''}</span>
          <span>{days.at(-1) ? label(days.at(-1)?.date ?? '') : ''}</span>
        </div>
      </div>
      <table className="sr-only">
        <caption>Credits used per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Credits</th>
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
      </table>
    </figure>
  );
}

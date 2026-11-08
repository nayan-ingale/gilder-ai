'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetUsageEventsQuery, useGetUsageSummaryQuery } from '@/store/api';
import { DailyChart, fillDays } from './daily-chart';

const DAYS = 30;
const AGENT_NAMES: Record<string, string> = {
  chat: 'Chat',
  search: 'Search',
  code: 'Code',
  pdf: 'PDF',
  slides: 'Slides',
  image: 'Image',
  pdf_qa: 'PDF questions',
  image_qa: 'Image questions',
};
const timeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** Where credits went: totals, per day, per agent, and the latest answers. */
export function UsageView() {
  // Days are counted on the viewer's own clock.
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const summary = useGetUsageSummaryQuery({ days: DAYS, timeZone });
  const events = useGetUsageEventsQuery();
  const data = summary.data;
  const answers = data?.byAgent.reduce((sum, row) => sum + row.answers, 0) ?? 0;
  const largest = Math.max(1, ...(data?.byAgent.map((row) => row.credits) ?? [1]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header>
        <h1 className="text-xl text-fg">Usage</h1>
        <p className="mt-1 text-sm text-fg-muted">Credits used in the last {DAYS} days.</p>
      </header>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3">
        {[
          { label: 'Credits used', value: data?.totalCredits },
          { label: 'Answers', value: data ? answers : undefined },
        ].map((tile) => (
          <div key={tile.label} className="rounded-lg border border-line bg-raised p-4">
            <p className="text-sm text-fg-subtle">{tile.label}</p>
            {tile.value === undefined ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">
                {tile.value.toLocaleString('en-IN')}
              </p>
            )}
          </div>
        ))}
      </section>

      <section aria-labelledby="per-day" className="rounded-lg border border-line bg-raised p-4">
        <h2 id="per-day" className="mb-4 text-sm text-fg">
          Credits per day
        </h2>
        {data ? (
          <DailyChart days={fillDays(data.byDay, DAYS, new Date(), timeZone)} />
        ) : (
          <Skeleton className="h-44" />
        )}
      </section>

      <section aria-labelledby="per-agent" className="rounded-lg border border-line bg-raised p-4">
        <h2 id="per-agent" className="mb-3 text-sm text-fg">
          By agent
        </h2>
        {data && data.byAgent.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {data.byAgent.map((row) => (
              <li
                key={row.agent}
                className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm"
              >
                <span className="truncate text-fg">{AGENT_NAMES[row.agent] ?? row.agent}</span>
                <span className="h-2 rounded-full bg-sunken">
                  <span
                    className="block h-2 rounded-full bg-chart-bar"
                    style={{ width: `${Math.max((row.credits / largest) * 100, 2)}%` }}
                  />
                </span>
                <span className="text-fg-muted tabular-nums">
                  {row.credits.toLocaleString('en-IN')} · {row.answers}{' '}
                  {row.answers === 1 ? 'answer' : 'answers'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-subtle">
            {summary.isLoading ? 'Loading…' : 'No answers yet.'}
          </p>
        )}
      </section>

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 text-base text-fg">
          Recent answers
        </h2>
        {events.data && events.data.items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-sunken text-xs text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Credits</th>
                  <th className="px-3 py-2 font-medium">Tokens in / out</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.data.items.map((event) => (
                  <tr key={event.id} className="border-t border-line text-fg">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {timeFormat.format(new Date(event.at))}
                    </td>
                    <td className="px-3 py-2">{AGENT_NAMES[event.agent] ?? event.agent}</td>
                    <td className="px-3 py-2 tabular-nums">{event.credits}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {event.inputTokens ?? '–'} / {event.outputTokens ?? '–'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {event.latencyMs === null ? '–' : `${(event.latencyMs / 1000).toFixed(1)} s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">
            {events.isLoading ? 'Loading…' : 'No answers yet.'}
          </p>
        )}
      </section>
    </div>
  );
}

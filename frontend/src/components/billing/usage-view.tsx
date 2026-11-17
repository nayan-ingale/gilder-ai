'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ClockIcon, StopIcon, TickIcon } from '@/components/settings/icons';
import { useHydrated } from '@/components/settings/use-hydrated';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type Account,
  agentName,
  formatDuration,
  formatTokens,
  formatWhen,
  shortDate,
  type UsageEvent,
} from '@/lib/billing';
import {
  useGetAccountQuery,
  useGetUsageEventsQuery,
  useGetUsageSummaryQuery,
  useListChatsInfiniteQuery,
} from '@/store/api';
import { DailyChart, DayTable, fillDays, formatDayRange } from './daily-chart';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const CARD = 'rounded-lg border border-line bg-surface';

/** A segmented control's button: raised when on, quiet when off. */
function segment(on: boolean) {
  return on
    ? 'border-line bg-raised font-medium text-fg'
    : 'border-transparent text-fg-muted hover:text-fg';
}

/**
 * Where credits went over 7, 30 or 90 days: totals, the time to the first word, per day, per
 * agent, and the latest requests.
 */
export function UsageView() {
  // Days are counted on the viewer's own clock.
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [days, setDays] = useState<Range>(30);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const summary = useGetUsageSummaryQuery({ days, timeZone });
  const events = useGetUsageEventsQuery();
  const account = useGetAccountQuery();
  // The chats the sidebar already loaded, to name the chat of each request.
  const chats = useListChatsInfiniteQuery();
  // Nothing from the store until the page has hydrated, so the first render matches the server's.
  const ready = useHydrated();
  const titles = useMemo(
    () =>
      new Map(
        (chats.data?.pages ?? []).flatMap((page) =>
          page.items.map((chat) => [chat.id, chat.title]),
        ),
      ),
    [chats.data],
  );

  // While another range loads, the last one stays on screen, dimmed, so nothing jumps.
  const data = ready ? summary.data : undefined;
  const balance = ready ? account.data?.account : undefined;
  const latest = ready ? events.data?.items : undefined;
  const stale = data !== undefined && data.days !== days;
  const filled = data ? fillDays(data.byDay, data.days, new Date(), timeZone) : undefined;
  const largest = Math.max(1, ...(data?.byAgent.map((row) => row.credits) ?? [1]));
  const period = `last ${days} days`;

  const tiles = [
    {
      label: 'Credits used',
      value: data?.totalCredits.toLocaleString('en-IN'),
      note: `Last ${days} days`,
    },
    {
      label: 'Requests',
      value: data?.totalAnswers.toLocaleString('en-IN'),
      note: `Last ${days} days`,
    },
    {
      label: 'Time to first token',
      value: data
        ? data.medianFirstTokenMs === null
          ? '—'
          : formatDuration(data.medianFirstTokenMs)
        : undefined,
      note: `Median, ${period}`,
    },
    {
      label: 'Balance',
      value: balance?.balance.toLocaleString('en-IN'),
      note: balance ? balanceNote(balance) : '',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg text-fg">Usage</h2>
        <div
          role="group"
          aria-label="Time range"
          className="flex gap-0.5 rounded-md border border-line bg-sunken p-[3px]"
        >
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => setDays(range)}
              className={cn(
                'min-h-9 rounded-sm border px-3.5 text-[13px] transition-colors',
                segment(days === range),
              )}
            >
              {range} days
            </button>
          ))}
        </div>
      </div>

      <div
        aria-busy={stale}
        className={cn(
          'flex flex-col gap-6 transition-opacity',
          stale && 'opacity-60 motion-reduce:transition-none',
        )}
      >
        <section
          aria-label="Totals"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3"
        >
          {tiles.map((tile) => (
            <div key={tile.label} className={`${CARD} flex flex-col gap-1.5 p-[18px]`}>
              <span className="text-[13px] text-fg-muted">{tile.label}</span>
              {tile.value === undefined ? (
                <Skeleton className="h-[37px] w-24" />
              ) : (
                <span className="text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-fg">
                  {tile.value}
                </span>
              )}
              <span className="text-[12.5px] text-fg-subtle">{tile.note}</span>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-4">
          <section
            aria-labelledby="daily-title"
            className={`${CARD} flex min-w-0 flex-[2_1_520px] flex-col gap-3.5 p-5`}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="mr-auto flex flex-col">
                <h3 id="daily-title" className="text-[15px] text-fg">
                  Credits used per day
                </h3>
                <span className="text-[12.5px] text-fg-muted">
                  {filled && filled.length > 0
                    ? formatDayRange(filled[0]?.date ?? '', filled.at(-1)?.date ?? '')
                    : '\u00a0'}
                </span>
              </span>
              <div
                role="group"
                aria-label="Show as"
                className="flex gap-0.5 rounded-md border border-line bg-sunken p-[3px]"
              >
                {(['chart', 'table'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={view === choice}
                    onClick={() => setView(choice)}
                    className={cn(
                      'min-h-8 rounded-sm border px-3 text-[12.5px] transition-colors',
                      segment(view === choice),
                    )}
                  >
                    {choice === 'chart' ? 'Chart' : 'Table'}
                  </button>
                ))}
              </div>
            </div>
            {filled ? (
              view === 'chart' ? (
                <DailyChart days={filled} />
              ) : (
                <DayTable days={filled} />
              )
            ) : (
              <Skeleton className="h-[236px]" />
            )}
          </section>

          <section
            aria-labelledby="agent-title"
            className={`${CARD} flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 p-5`}
          >
            <span className="flex flex-col">
              <h3 id="agent-title" className="text-[15px] text-fg">
                Spend by agent
              </h3>
              <span className="text-[12.5px] text-fg-muted">
                {data
                  ? `${data.totalCredits.toLocaleString('en-IN')} ${data.totalCredits === 1 ? 'credit' : 'credits'} across ${data.totalAnswers.toLocaleString('en-IN')} ${data.totalAnswers === 1 ? 'request' : 'requests'}`
                  : '\u00a0'}
              </span>
            </span>
            {data && data.byAgent.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {data.byAgent.map((row) => (
                  <li key={row.agent} className="flex items-center gap-3">
                    <span className="w-[78px] shrink-0 text-[13.5px] text-fg">
                      {agentName(row.agent)}
                    </span>
                    <span aria-hidden="true" className="flex min-w-0 grow items-center">
                      <span
                        className="block h-2.5 rounded-r bg-chart-bar"
                        style={{ width: `${Math.max((row.credits / largest) * 100, 2)}%` }}
                      />
                    </span>
                    <span className="w-[92px] shrink-0 text-right text-[13px] text-fg tabular-nums">
                      {row.credits.toLocaleString('en-IN')}{' '}
                      <span className="text-fg-muted">
                        · {row.answers} {row.answers === 1 ? 'req' : 'reqs'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-subtle">
                {!ready || summary.isLoading ? 'Loading…' : `No requests in the ${period}.`}
              </p>
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="activity-title" className="flex flex-col gap-3">
        <h3 id="activity-title" className="text-[15px] text-fg">
          Recent activity
        </h3>
        {latest && latest.length > 0 ? (
          <ActivityTable items={latest} titles={titles} />
        ) : (
          <p className="text-sm text-fg-subtle">
            {!ready || events.isLoading ? 'Loading…' : 'No requests yet.'}
          </p>
        )}
      </section>
    </div>
  );
}

/** Under the balance: when the plan's badge ends, or that credits never expire. */
function balanceNote(account: Account): string {
  if (account.plan !== 'free' && account.planExpiresAt) {
    const ends = new Date(account.planExpiresAt);
    if (ends.getTime() > Date.now()) {
      return `Plan active until ${shortDate.format(ends)}`;
    }
  }
  return 'Credits never expire';
}

const STATUS: Record<
  UsageEvent['status'],
  { label: string; className: string; icon: typeof TickIcon }
> = {
  done: { label: 'Done', className: 'bg-success-soft text-success', icon: TickIcon },
  stopped: { label: 'Stopped', className: 'bg-sunken text-fg-muted', icon: StopIcon },
  running: { label: 'In progress', className: 'bg-accent-soft text-accent-text', icon: ClockIcon },
};

const TH = 'border-b border-line px-4 py-[11px] text-[12.5px] font-medium text-fg-muted';
const TD = 'border-b border-line px-4 py-[11px]';

function tokens(event: UsageEvent): string {
  if (event.inputTokens === null && event.outputTokens === null) {
    return '—';
  }
  const show = (count: number | null) => (count === null ? '—' : formatTokens(count));
  return `${show(event.inputTokens)} / ${show(event.outputTokens)}`;
}

function timing(event: UsageEvent): string {
  if (event.firstTokenMs === null && event.latencyMs === null) {
    return '—';
  }
  const show = (ms: number | null) => (ms === null ? '—' : formatDuration(ms));
  return `${show(event.firstTokenMs)} · ${show(event.latencyMs)}`;
}

/** The latest requests: when, in which chat, the agent, the cost, tokens, timing and status. */
function ActivityTable({
  items,
  titles,
}: {
  items: readonly UsageEvent[];
  titles: ReadonlyMap<string, string>;
}) {
  const now = new Date();
  return (
    // Focusable, so keyboard users can scroll the table sideways on a narrow screen.
    <div
      role="region"
      aria-label="Recent activity table"
      tabIndex={0}
      className={`${CARD} overflow-x-auto`}
    >
      <table className="w-full min-w-[820px] border-collapse text-[13.5px] text-fg">
        <thead>
          <tr>
            <th scope="col" className={`${TH} text-left`}>
              When
            </th>
            <th scope="col" className={`${TH} text-left`}>
              Chat
            </th>
            <th scope="col" className={`${TH} text-left`}>
              Agent
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Credits
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Tokens in / out
            </th>
            <th scope="col" className={`${TH} text-right`}>
              First token · total
            </th>
            <th scope="col" className={`${TH} text-left`}>
              Status
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {items.map((event) => {
            const status = STATUS[event.status];
            const Icon = status.icon;
            return (
              <tr key={event.id}>
                <td className={`${TD} whitespace-nowrap text-fg-muted`}>
                  {formatWhen(new Date(event.at), now)}
                </td>
                <td className={`${TD} max-w-[220px]`}>
                  {event.chatId ? (
                    <Link
                      href={`/c/${event.chatId}`}
                      className="block truncate hover:underline"
                      title={titles.get(event.chatId)}
                    >
                      {titles.get(event.chatId) ?? 'Chat'}
                    </Link>
                  ) : (
                    <span className="text-fg-muted">—</span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{agentName(event.agent)}</td>
                <td className={`${TD} text-right tabular-nums`}>{event.credits}</td>
                <td className={`${TD} text-right text-fg-muted tabular-nums`}>{tokens(event)}</td>
                <td className={`${TD} text-right whitespace-nowrap text-fg-muted tabular-nums`}>
                  {timing(event)}
                </td>
                <td className={TD}>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-[12.5px] whitespace-nowrap',
                      status.className,
                    )}
                  >
                    <Icon size={12} strokeWidth={2.5} />
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

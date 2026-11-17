'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { cn } from '@/components/ui/cn';

export const SETTINGS_TABS = [
  { segment: 'general', label: 'General', href: '/settings/general' },
  { segment: 'billing', label: 'Billing', href: '/settings/billing' },
  { segment: 'usage', label: 'Usage', href: '/settings/usage' },
] as const;

/** The tabs with the open one marked; any page under a tab (a receipt) keeps it marked. */
export function SettingsTabs() {
  return <SettingsTabList active={useSelectedLayoutSegment()} />;
}

/**
 * The tab links. The line under them is an inset shadow, so the row can scroll sideways on a
 * narrow screen without cutting off the open tab's underline.
 */
export function SettingsTabList({ active }: { active: string | null }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-line)]"
    >
      {SETTINGS_TABS.map((tab) => {
        const current = tab.segment === active;
        return (
          <Link
            key={tab.segment}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3.5 text-sm whitespace-nowrap',
              current
                ? 'border-accent font-semibold text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

import { Suspense } from 'react';
import { SettingsTabList, SettingsTabs } from '@/components/settings/settings-tabs';

/**
 * Every settings page: one "Settings" heading and the General, Billing and Usage tabs, then the
 * page, at most 1040px wide. The tabs read the open page, which a receipt's address only gives
 * at request time, so they wait in a boundary that first shows them with none marked.
 */
export default function SettingsLayout({ children }: LayoutProps<'/settings'>) {
  return (
    <div className="flex justify-center px-4 pt-6 pb-10 sm:px-10 sm:pt-9 sm:pb-12">
      <div className="flex w-full max-w-[1040px] min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-4 print:hidden">
          <h1 className="text-[30px] leading-tight text-fg">Settings</h1>
          <Suspense fallback={<SettingsTabList active={null} />}>
            <SettingsTabs />
          </Suspense>
        </div>
        {children}
      </div>
    </div>
  );
}

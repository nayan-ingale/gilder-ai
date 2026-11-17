import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { GeneralSettings } from '@/components/settings/general-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentUser } from '@/server/session';

export const metadata: Metadata = { title: 'General' };

/** The General tab. The profile comes from the session, as the sidebar's does. */
export default function GeneralPage() {
  return (
    <Suspense fallback={<GeneralSkeleton />}>
      <General />
    </Suspense>
  );
}

async function General() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return <GeneralSettings user={user} />;
}

function GeneralSkeleton() {
  return (
    <div className="flex flex-col gap-7 pt-1">
      <span className="sr-only">Loading your settings</span>
      <Skeleton className="h-[100px] rounded-lg" />
      <Skeleton className="h-[86px] rounded-lg" />
      <Skeleton className="h-[160px] rounded-lg" />
    </div>
  );
}

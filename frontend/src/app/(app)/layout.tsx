import { Suspense } from 'react';
import { ChatCommands } from '@/components/chats/chat-commands';
import {
  MobileBar,
  SidebarAccount,
  SidebarAccountSkeleton,
  SidebarFrame,
} from '@/components/app-shell/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The signed-in app: sidebar on the left (a top bar on small screens), the page on the right.
 * ChatCommands adds the ⌘K search and ⌘⇧O new-chat shortcuts everywhere inside.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <ChatCommands>
      <div className="flex h-dvh overflow-hidden">
        <SidebarFrame>
          <Suspense fallback={<SidebarAccountSkeleton />}>
            <SidebarAccount />
          </Suspense>
        </SidebarFrame>
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar>
            <Suspense fallback={<Skeleton className="size-7 rounded-full" />}>
              <SidebarAccount compact />
            </Suspense>
          </MobileBar>
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
      </div>
    </ChatCommands>
  );
}

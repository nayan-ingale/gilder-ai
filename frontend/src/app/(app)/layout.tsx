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
        <SidebarFrame
          account={
            <Suspense fallback={<SidebarAccountSkeleton />}>
              <SidebarAccount />
            </Suspense>
          }
          railAccount={
            <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
              <SidebarAccount compact />
            </Suspense>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar
            account={
              <Suspense fallback={<SidebarAccountSkeleton />}>
                <SidebarAccount />
              </Suspense>
            }
          />
          {/* Focusable, so keyboard users can scroll it even on pages with no links or buttons.
              Relative, so absolutely positioned content (screen-reader-only labels) stays inside
              this scroller; otherwise it overflows the page and the whole app can scroll away. */}
          <main
            tabIndex={0}
            className="relative flex min-h-0 flex-1 flex-col overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          >
            {children}
          </main>
        </div>
      </div>
    </ChatCommands>
  );
}

'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StoreProvider } from '@/store/store';

/** Client-side providers every page shares: the data store, toasts and tooltip timing. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </StoreProvider>
  );
}

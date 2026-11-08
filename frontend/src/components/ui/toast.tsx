'use client';

import { Toast as ToastPrimitive } from 'radix-ui';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from './cn';

export interface ToastMessage {
  title: string;
  description?: string;
  tone?: 'default' | 'danger';
  /** The request ID of a failed call, shown so the user can quote it when reporting a problem. */
  requestId?: string;
}

interface ShownToast extends ToastMessage {
  id: number;
}

const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);

/** Shows short messages in a corner. Screen readers announce them; they hide after 6 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ShownToast[]>([]);
  const show = useCallback((message: ToastMessage) => {
    setToasts((current) => [...current, { ...message, id: Date.now() + Math.random() }]);
  }, []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      <ToastPrimitive.Provider duration={6000}>
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            onOpenChange={(open) => {
              if (!open) {
                setToasts((current) => current.filter((item) => item.id !== toast.id));
              }
            }}
            className={cn(
              'rounded-lg border bg-raised p-3 shadow-lg',
              toast.tone === 'danger' ? 'border-danger' : 'border-line',
            )}
          >
            <ToastPrimitive.Title className="text-sm font-medium text-fg">
              {toast.title}
            </ToastPrimitive.Title>
            {toast.description ? (
              <ToastPrimitive.Description className="mt-0.5 text-sm text-fg-muted">
                {toast.description}
              </ToastPrimitive.Description>
            ) : null}
            {toast.requestId ? (
              <p className="mt-1 font-mono text-xs text-fg-subtle">
                Reference: {toast.requestId.slice(0, 8)}
              </p>
            ) : null}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" />
      </ToastPrimitive.Provider>
    </ToastContext>
  );
}

/** Returns a function that shows a toast. Must be used inside ToastProvider. */
export function useToast(): (message: ToastMessage) => void {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return show;
}

'use client';

import { AlertCircle, Info, X } from 'lucide-react';
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

/**
 * Shows short messages at the top right, under the page header. Screen readers announce them; they
 * hide after 6 seconds or when dismissed.
 */
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
            className="flex gap-3 rounded-md border border-line bg-raised p-3.5 shadow-raised"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full',
                toast.tone === 'danger'
                  ? 'bg-danger-soft text-danger'
                  : 'bg-accent-soft text-accent-text',
              )}
            >
              {toast.tone === 'danger' ? (
                <AlertCircle size={15} strokeWidth={2} />
              ) : (
                <Info size={15} strokeWidth={2} />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <ToastPrimitive.Title className="text-sm font-semibold text-fg">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description ? (
                <ToastPrimitive.Description className="text-[13px] leading-[1.45] text-fg-muted">
                  {toast.description}
                </ToastPrimitive.Description>
              ) : null}
              {toast.requestId ? (
                <p className="text-xs text-fg-subtle">
                  Reference: <code className="font-mono">{toast.requestId.slice(0, 8)}</code>
                </p>
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-sunken hover:text-fg"
            >
              <X size={15} aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed top-16 right-4 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 md:top-[76px] md:right-7" />
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

'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ReactNode, useRef } from 'react';
import { IconButton } from './button';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}

/**
 * A modal dialog. Radix keeps focus inside it and closes it on Escape; the title and description
 * are wired to it for screen readers. Focus goes back to whatever opened it, even a plain button
 * or a menu item (Radix only does that by itself for its own Trigger).
 */
export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  const returnFocusTo = useRef<HTMLElement | null>(null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-canvas/70" />
        <DialogPrimitive.Content
          onOpenAutoFocus={() => {
            // Runs before focus moves into the dialog, so this is still the opener.
            returnFocusTo.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            const opener = returnFocusTo.current;
            if (opener?.isConnected) {
              event.preventDefault();
              opener.focus();
            }
          }}
          className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-raised p-5 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-base text-fg">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close" icon={<X size={16} />} size="sm" className="-mt-1 -mr-2" />
            </DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm text-fg-muted">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          {children ? <div className="mt-4">{children}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

'use client';

import { DropdownMenu as Menu } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';

/** A menu that opens from a button, with arrow-key navigation and type-ahead from Radix. */
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  className,
  align = 'end',
  ...props
}: ComponentPropsWithoutRef<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-44 rounded-lg border border-line bg-raised p-1 text-sm text-fg shadow-lg',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof Menu.Item> {
  icon?: ReactNode;
  tone?: 'default' | 'danger';
}

export function DropdownMenuItem({
  icon,
  tone = 'default',
  className,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface',
        tone === 'danger' ? 'text-danger' : 'text-fg',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex text-fg-subtle">
          {icon}
        </span>
      ) : null}
      {children}
    </Menu.Item>
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2 py-1.5 text-xs text-fg-subtle', className)} {...props} />;
}

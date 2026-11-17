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
          'z-50 min-w-44 rounded-md border border-line bg-raised p-1.5 text-[13.5px] text-fg shadow-raised',
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
        'flex min-h-[38px] cursor-default items-center gap-2.5 rounded-sm px-2.5 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-sunken',
        tone === 'danger' ? 'text-danger' : 'text-fg',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
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

/** A group of choices in a menu where exactly one is on, such as the theme. */
export const DropdownMenuRadioGroup = Menu.RadioGroup;

/** One choice in a DropdownMenuRadioGroup; picking it keeps the menu open. */
export function DropdownMenuRadioItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      onSelect={(event) => event.preventDefault()}
      className={cn('cursor-default outline-none select-none', className)}
      {...props}
    />
  );
}

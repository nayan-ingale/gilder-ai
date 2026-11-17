// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { Dialog } from './dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ToastProvider, useToast } from './toast';
import { Tooltip, TooltipProvider } from './tooltip';

// jsdom lacks a few browser APIs that Radix's positioning uses.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

describe('DropdownMenu', () => {
  it('opens from the keyboard and runs the chosen item', async () => {
    const onRename = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Chat options</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem tone="danger">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole('button', { name: 'Chat options' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Delete' }).className).toContain('text-danger');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Dialog', () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Delete chat</Button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Delete this chat?"
          description="This can't be undone."
        >
          <Button variant="danger">Delete</Button>
        </Dialog>
      </>
    );
  }

  it('is a named modal that closes on Escape and gives focus back', async () => {
    render(<Example />);
    const opener = screen.getByRole('button', { name: 'Delete chat' });

    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Delete this chat?' });
    expect(dialog.textContent).toContain("This can't be undone.");
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    // Radix hands focus back once the closing has finished.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    return (
      <Button
        onClick={() =>
          toast({ title: 'Something went wrong', tone: 'danger', requestId: '7f3c9a10-aaaa-bbbb' })
        }
      >
        Fail
      </Button>
    );
  }

  it('shows the message with a short request reference', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fail' }));

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('7f3c9a10').closest('p')?.textContent).toBe('Reference: 7f3c9a10');
  });

  it('refuses to be used outside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow('useToast must be used inside <ToastProvider>');
  });
});

describe('Tooltip', () => {
  it('shows its text when the trigger gets keyboard focus', async () => {
    render(
      <TooltipProvider>
        <Tooltip content="Start a new chat">
          <Button>New</Button>
        </Tooltip>
      </TooltipProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'New' }).focus();
    });

    expect((await screen.findAllByText('Start a new chat')).length).toBeGreaterThan(0);
  });
});

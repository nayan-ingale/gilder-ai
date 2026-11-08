// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Avatar, initials } from './avatar';
import { Badge } from './badge';
import { Button, IconButton } from './button';
import { Chip } from './chip';
import { Input, Textarea } from './input';
import { Kbd } from './kbd';
import { Skeleton } from './skeleton';

afterEach(cleanup);

describe('Button', () => {
  it('is a real button that never submits a form by accident', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does nothing while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is named by its label, and hides the icon from screen readers', () => {
    render(<IconButton label="New chat" icon={<Plus />} />);

    const button = screen.getByRole('button', { name: 'New chat' });
    expect(button.getAttribute('title')).toBe('New chat');
    expect(button.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });
});

describe('Chip', () => {
  it('tells screen readers whether it is on', async () => {
    function Toggle() {
      const [on, setOn] = useState(false);
      return (
        <Chip selected={on} onClick={() => setOn(!on)}>
          Search
        </Chip>
      );
    }
    render(<Toggle />);
    const chip = screen.getByRole('button', { name: 'Search' });

    expect(chip.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('fields and small pieces', () => {
  it('render the native elements with their props', () => {
    render(
      <>
        <Input aria-label="Email" placeholder="you@example.com" />
        <Textarea aria-label="Message" />
        <Badge tone="success">Paid</Badge>
        <Kbd>⌘K</Kbd>
        <Skeleton data-testid="skeleton" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Email' }).getAttribute('placeholder')).toBe(
      'you@example.com',
    );
    expect(screen.getByRole('textbox', { name: 'Message' }).tagName).toBe('TEXTAREA');
    expect(screen.getByText('Paid').className).toContain('text-success');
    expect(screen.getByText('⌘K').tagName).toBe('KBD');
    expect(screen.getByTestId('skeleton').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Avatar', () => {
  it('shows initials when there is no picture', () => {
    render(<Avatar name="Nayan Ingale" />);

    expect(screen.getByText('NI').getAttribute('aria-label')).toBe('Nayan Ingale');
  });

  it('makes initials from the first two words, or "?" for no name', () => {
    expect(initials('nayan')).toBe('N');
    expect(initials('  Ada  Lovelace  King ')).toBe('AL');
    expect(initials('')).toBe('?');
  });
});

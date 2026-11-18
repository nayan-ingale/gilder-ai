// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadError } from './load-error';

afterEach(cleanup);

describe('LoadError', () => {
  it('says the page did not load and tries again on request', async () => {
    const retry = vi.fn();
    render(<LoadError digest="632034572" retry={retry} />);

    expect(screen.getByRole('heading', { name: 'This page didn’t load' })).toBeTruthy();
    expect(screen.getByText('632034572')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('leaves out the reference when the error has no digest', () => {
    render(<LoadError retry={() => {}} />);

    expect(screen.queryByText(/Reference/)).toBeNull();
  });
});

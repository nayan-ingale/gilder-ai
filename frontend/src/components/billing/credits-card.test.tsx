// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '@/store/store';
import { type ApiAnswer, type ApiCall, json, mockApi } from '@/test/mock-api';
import { CreditsCard } from './credits-card';

let calls: ApiCall[];
let answer: ApiAnswer;

beforeEach(() => {
  calls = mockApi(() => answer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderCard() {
  render(
    <StoreProvider>
      <CreditsCard />
    </StoreProvider>,
  );
}

describe('CreditsCard', () => {
  it('shows the balance and the plan from billing', async () => {
    answer = () => json({ account: { plan: 'starter', planExpiresAt: null, balance: 1250 } });
    renderCard();

    const card = await screen.findByRole('region', { name: 'Credits' });
    expect(card.textContent).toContain('1,250 credits');
    expect(card.textContent).toContain('Starter');
    expect(card.textContent).not.toContain('Running low');
    expect(calls).toEqual([{ method: 'GET', path: '/api/billing/account', body: undefined }]);
  });

  it('warns when the balance is running low', async () => {
    answer = () => json({ account: { plan: 'free', planExpiresAt: null, balance: 1 } });
    renderCard();

    const card = await screen.findByRole('region', { name: 'Credits' });
    expect(card.textContent).toContain('1 credit');
    expect(card.textContent).toContain('Running low');
  });

  it('stays out of the way when billing cannot answer', async () => {
    answer = () => json({ code: 'service_unavailable' }, 503);
    renderCard();

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await vi.waitFor(() => expect(screen.queryByLabelText('Loading your credits')).toBeNull());
    expect(screen.queryByRole('region', { name: 'Credits' })).toBeNull();
  });
});

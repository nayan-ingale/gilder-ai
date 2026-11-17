// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Receipt } from '@/lib/billing';
import { ReceiptView } from './receipt-view';

const receipt: Receipt = {
  number: 'GA-2026-1F3A9C2B',
  orderId: 'order_Abc123',
  paymentId: 'pay_Xyz789',
  plan: 'starter',
  planName: 'Starter',
  amountPaise: 19_900,
  credits: 500,
  status: 'paid',
  currency: 'INR',
  // 13:31 in India.
  createdAt: '2026-11-04T08:00:00.000Z',
  paidAt: '2026-11-04T08:01:00.000Z',
  testMode: true,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
});

function renderReceipt(overrides: Partial<Receipt> = {}) {
  render(
    <ReceiptView
      receipt={{ ...receipt, ...overrides }}
      billedTo={{ name: 'Asha Rao', email: 'settings@example.com' }}
    />,
  );
}

describe('ReceiptView', () => {
  it('shows the receipt: number, dates, plan, credits, amount, references and who paid', () => {
    renderReceipt();

    const sheet = screen.getByRole('article', { name: 'Receipt' });
    expect(within(sheet).getAllByText('GA-2026-1F3A9C2B')).toHaveLength(2);
    expect(within(sheet).getByText('Nov 4, 2026, 13:31 IST')).toBeTruthy();
    expect(within(sheet).getByText('Starter plan')).toBeTruthy();
    expect(within(sheet).getByText('+500')).toBeTruthy();
    expect(within(sheet).getAllByText('₹199.00')).toHaveLength(2);
    expect(within(sheet).getByText('order_Abc123')).toBeTruthy();
    expect(within(sheet).getByText('pay_Xyz789')).toBeTruthy();
    expect(within(sheet).getByText('Paid')).toBeTruthy();
    expect(within(sheet).getByText('Asha Rao')).toBeTruthy();
    expect(within(sheet).getByText('settings@example.com')).toBeTruthy();
    expect(within(sheet).getByText('Test payment — no money was charged.')).toBeTruthy();
  });

  it('leaves out the test marker for a live payment', () => {
    renderReceipt({ testMode: false });

    expect(screen.queryByText('Test payment — no money was charged.')).toBeNull();
  });

  it('prints, in the light theme, and then puts the dark theme back', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      window.dispatchEvent(new Event('beforeprint'));
      expect(document.documentElement.dataset.theme).toBe('light');
      window.dispatchEvent(new Event('afterprint'));
    });
    document.documentElement.dataset.theme = 'dark';
    renderReceipt();

    await userEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }));

    expect(print).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('links back to billing', () => {
    renderReceipt();

    expect(screen.getByRole('link', { name: 'Back to billing' }).getAttribute('href')).toBe(
      '/settings/billing',
    );
  });
});

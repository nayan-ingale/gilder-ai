// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { StoreProvider } from '@/store/store';
import { type ApiAnswer, type ApiCall, json, mockApi } from '@/test/mock-api';
import { BillingView } from './billing-view';
import { UsageView } from './usage-view';

const openCheckout = vi.fn();
vi.mock('@/lib/razorpay-checkout', () => ({
  openCheckout: (...args: unknown[]) => openCheckout(...args),
}));

let calls: ApiCall[];
let answer: ApiAnswer;

beforeEach(() => {
  calls = mockApi(() => answer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const PLANS = {
  plans: [
    { id: 'starter', name: 'Starter', pricePaise: 19_900, credits: 500, validityDays: 30 },
    { id: 'pro', name: 'Pro', pricePaise: 49_900, credits: 1_000, validityDays: 30 },
  ],
  currency: 'INR',
  testMode: true,
};

const billingApi: ApiAnswer = ({ method, path }) => {
  if (path === '/api/billing/account') {
    return json({ account: { plan: 'free', planExpiresAt: null, balance: 42 } });
  }
  if (path === '/api/billing/plans') {
    return json(PLANS);
  }
  if (path === '/api/billing/payments') {
    return json({ items: [] });
  }
  if (method === 'POST' && path === '/api/billing/orders') {
    return json(
      {
        order: { id: 'order_1', amountPaise: 19_900, currency: 'INR', planId: 'starter' },
        keyId: 'rzp_test_key',
      },
      201,
    );
  }
  if (method === 'POST' && path === '/api/billing/orders/order_1/verify') {
    return json({ account: { plan: 'starter', planExpiresAt: null, balance: 542 }, granted: true });
  }
  return json({}, 404);
};

function renderWith(node: React.ReactNode) {
  render(
    <StoreProvider>
      <ToastProvider>{node}</ToastProvider>
    </StoreProvider>,
  );
}

describe('BillingView', () => {
  it('shows the test-mode note, the balance and the plans priced in rupees', async () => {
    answer = billingApi;
    renderWith(<BillingView />);

    expect(await screen.findByText('Test payments only.')).toBeTruthy();
    expect(await screen.findByText('42')).toBeTruthy();
    expect(await screen.findByText('₹199')).toBeTruthy();
    expect(screen.getByText('₹499')).toBeTruthy();
    expect(screen.getByText('No payments yet.')).toBeTruthy();
  });

  it('buys a plan: order, checkout, then the server checks the payment', async () => {
    answer = billingApi;
    openCheckout.mockResolvedValue({ paymentId: 'pay_1', signature: 'sig' });
    renderWith(<BillingView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Buy Starter' }));

    expect(await screen.findByText('500 credits added')).toBeTruthy();
    expect(openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ keyId: 'rzp_test_key', orderId: 'order_1', amountPaise: 19_900 }),
    );
    expect(calls.find((call) => call.path === '/api/billing/orders')?.body).toEqual({
      planId: 'starter',
    });
    expect(calls.find((call) => call.path.endsWith('/verify'))?.body).toEqual({
      paymentId: 'pay_1',
      signature: 'sig',
    });
  });

  it('does nothing more when the payment window is closed', async () => {
    answer = billingApi;
    openCheckout.mockResolvedValue(null);
    renderWith(<BillingView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Buy Pro' }));

    await waitFor(() => expect(openCheckout).toHaveBeenCalled());
    expect(calls.some((call) => call.path.endsWith('/verify'))).toBe(false);
  });
});

describe('UsageView', () => {
  it('shows totals, credits per agent and the latest answers', async () => {
    const today = new Date().toISOString().slice(0, 10);
    answer = ({ path }) =>
      path.startsWith('/api/usage/summary')
        ? json({
            days: 30,
            totalCredits: 11,
            byAgent: [
              { agent: 'search', credits: 10, answers: 2 },
              { agent: 'chat', credits: 1, answers: 1 },
            ],
            byDay: [{ date: today, credits: 11 }],
          })
        : json({
            items: [
              {
                id: 'e1',
                at: new Date().toISOString(),
                credits: 5,
                agent: 'search',
                model: 'm',
                inputTokens: 120,
                outputTokens: 40,
                latencyMs: 1500,
                chatId: null,
              },
            ],
          });
    renderWith(<UsageView />);

    const totals = await screen.findByRole('region', { name: 'Totals' });
    await waitFor(() => expect(within(totals).getByText('11')).toBeTruthy());
    expect(within(totals).getByText('3')).toBeTruthy();
    expect(screen.getByText('10 · 2 answers')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: /Credits used per day over 30 days: 11 in total/ }),
    ).toBeTruthy();
    expect(await screen.findByText('120 / 40')).toBeTruthy();
    expect(screen.getByText('1.5 s')).toBeTruthy();
  });
});

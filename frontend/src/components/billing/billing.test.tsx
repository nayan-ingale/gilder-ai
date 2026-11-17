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
  freePlan: { name: 'Free', credits: 100 },
  costs: [
    { agent: 'chat', credits: 1 },
    { agent: 'search', credits: 5 },
    { agent: 'pdf_qa', credits: 10 },
  ],
  currency: 'INR',
  testMode: true,
};

const SUMMARY = {
  days: 30,
  totalCredits: 12,
  totalAnswers: 3,
  medianFirstTokenMs: 900,
  byAgent: [
    { agent: 'search', credits: 10, answers: 2 },
    { agent: 'chat', credits: 2, answers: 1 },
  ],
  byDay: [{ date: new Date().toISOString().slice(0, 10), credits: 12 }],
};

const inAMonth = new Date(Date.now() + 30 * 86_400_000).toISOString();

function billingApi(
  account: object = { plan: 'free', planExpiresAt: null, balance: 42 },
  payments: object = { items: [], signupGrant: null },
): ApiAnswer {
  return ({ method, path }) => {
    if (path === '/api/billing/account') {
      return json({ account });
    }
    if (path === '/api/billing/plans') {
      return json(PLANS);
    }
    if (path === '/api/billing/payments') {
      return json(payments);
    }
    if (path.startsWith('/api/usage/summary')) {
      return json(SUMMARY);
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
      return json({
        account: { plan: 'starter', planExpiresAt: null, balance: 542 },
        granted: true,
      });
    }
    return json({}, 404);
  };
}

function renderWith(node: React.ReactNode) {
  render(
    <StoreProvider>
      <ToastProvider>{node}</ToastProvider>
    </StoreProvider>,
  );
}

describe('BillingView', () => {
  it('shows the test-mode note, the balance, the cost of each agent and the plans in rupees', async () => {
    answer = billingApi();
    renderWith(<BillingView />);

    expect(await screen.findByText('Test payments only.')).toBeTruthy();
    expect(await screen.findByText('42')).toBeTruthy();
    expect(await screen.findByText('₹199')).toBeTruthy();
    expect(screen.getByText('₹0')).toBeTruthy();
    expect(screen.getByText('₹499')).toBeTruthy();
    const costs = screen.getByRole('region', { name: 'Credit costs' });
    expect(within(costs).getByText('PDF Q&A')).toBeTruthy();
    expect(within(costs).getByText('5')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Included at sign-up' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      await screen.findByText(/12 used in the last 30 days\. Credits never expire\./),
    ).toBeTruthy();
    expect(screen.getByText('No payments yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View usage' }).getAttribute('href')).toBe(
      '/settings/usage',
    );
  });

  it('marks the current plan, offers to buy it again and to upgrade', async () => {
    answer = billingApi({ plan: 'starter', planExpiresAt: inAMonth, balance: 342 });
    renderWith(<BillingView />);

    expect(await screen.findByRole('button', { name: 'Buy again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    expect(screen.getByText('Current plan', { selector: 'li span' })).toBeTruthy();
    expect(
      await screen.findByText(/Plan active until .+\. Purchased credits never expire\./),
    ).toBeTruthy();
  });

  it('buys a plan: order, checkout, then the server checks the payment', async () => {
    answer = billingApi();
    openCheckout.mockResolvedValue({ paymentId: 'pay_1', signature: 'sig' });
    renderWith(<BillingView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Upgrade to Starter' }));

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
    answer = billingApi();
    openCheckout.mockResolvedValue(null);
    renderWith(<BillingView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Upgrade to Pro' }));

    await waitFor(() => expect(openCheckout).toHaveBeenCalled());
    expect(calls.some((call) => call.path.endsWith('/verify'))).toBe(false);
  });

  it('lists payments newest first with a receipt each, and the sign-up grant without one', async () => {
    answer = billingApi(undefined, {
      items: [
        {
          orderId: 'order_9',
          plan: 'pro',
          amountPaise: 49_900,
          credits: 1_000,
          status: 'paid',
          createdAt: '2026-11-04T08:00:00.000Z',
          paidAt: '2026-11-04T08:01:00.000Z',
        },
      ],
      signupGrant: { credits: 100, grantedAt: '2026-09-12T10:00:00.000Z' },
    });
    renderWith(<BillingView />);

    const history = await screen.findByRole('region', { name: 'Payment history table' });
    const rows = within(history).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Pro plan₹499.00+1,000Paid'),
      expect.stringContaining('Sign-up credits₹0.00+100Granted'),
    ]);
    const receipt = within(history).getByRole('link', { name: /^Download receipt for Pro plan/ });
    expect(receipt.getAttribute('href')).toBe('/settings/billing/receipts/order_9');
    expect(within(history).getAllByRole('link')).toHaveLength(1);
  });
});

const EVENTS = {
  items: [
    {
      id: 'e0',
      at: new Date().toISOString(),
      credits: 10,
      agent: 'slides',
      model: null,
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      firstTokenMs: null,
      chatId: null,
      status: 'running',
    },
    {
      id: 'e1',
      at: new Date().toISOString(),
      credits: 5,
      agent: 'search',
      model: 'm',
      inputTokens: 2_600,
      outputTokens: 40,
      latencyMs: 3_200,
      firstTokenMs: 900,
      chatId: 'c1',
      status: 'done',
    },
    {
      id: 'e2',
      at: new Date().toISOString(),
      credits: 1,
      agent: 'chat',
      model: 'm',
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      firstTokenMs: null,
      chatId: 'c-gone',
      status: 'stopped',
    },
  ],
};

const usageApi: ApiAnswer = ({ path }) => {
  if (path.startsWith('/api/usage/summary')) {
    const days = Number(new URLSearchParams(path.split('?')[1]).get('days'));
    return days === 7
      ? json({ ...SUMMARY, days, totalCredits: 4, byDay: [{ ...SUMMARY.byDay[0], credits: 4 }] })
      : json(SUMMARY);
  }
  if (path === '/api/usage/events?limit=30') {
    return json(EVENTS);
  }
  if (path === '/api/billing/account') {
    return json({ account: { plan: 'starter', planExpiresAt: inAMonth, balance: 342 } });
  }
  if (path === '/api/chats') {
    return json({
      items: [
        {
          id: 'c1',
          title: 'Lease agreement questions',
          pinned: false,
          lastMessageAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });
  }
  return json({}, 404);
};

describe('UsageView', () => {
  it('shows the totals, the median time to the first word, credits per agent and the balance', async () => {
    answer = usageApi;
    renderWith(<UsageView />);

    const totals = await screen.findByRole('region', { name: 'Totals' });
    await waitFor(() => expect(within(totals).getByText('12')).toBeTruthy());
    expect(within(totals).getByText('3')).toBeTruthy();
    expect(within(totals).getByText('0.9 s')).toBeTruthy();
    expect(within(totals).getByText('Median, last 30 days')).toBeTruthy();
    expect(await within(totals).findByText('342')).toBeTruthy();
    expect(screen.getByText('12 credits across 3 requests')).toBeTruthy();
    expect(screen.getByText('· 2 reqs')).toBeTruthy();
    expect(
      screen.getByRole('group', { name: /Credits used per day over 30 days: 12 in total/ }),
    ).toBeTruthy();
  });

  it('asks for another range and keeps every number on it', async () => {
    answer = usageApi;
    renderWith(<UsageView />);
    await screen.findByText('Median, last 30 days');

    await userEvent.click(screen.getByRole('button', { name: '7 days' }));

    expect(calls.some((call) => call.path.startsWith('/api/usage/summary?days=7&'))).toBe(true);
    expect(await screen.findByText('Median, last 7 days')).toBeTruthy();
    expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(await screen.findByRole('group', { name: /over 7 days: 4 in total/ })).toBeTruthy();
  });

  it('shows the days as a table when asked', async () => {
    answer = usageApi;
    renderWith(<UsageView />);
    await screen.findByRole('group', { name: /Credits used per day/ });

    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('region', { name: 'Credits used per day, as a table' });
    expect(within(table).getAllByRole('row')).toHaveLength(31);
    expect(screen.queryByRole('group', { name: /Credits used per day/ })).toBeNull();
  });

  it('lists the latest requests with their chat, tokens, timing and status', async () => {
    answer = usageApi;
    renderWith(<UsageView />);

    const activity = await screen.findByRole('region', { name: 'Recent activity table' });
    const named = await within(activity).findByRole('link', { name: 'Lease agreement questions' });
    expect(named.getAttribute('href')).toBe('/c/c1');
    // A chat the sidebar has not loaded still links, by its ID.
    expect(within(activity).getByRole('link', { name: 'Chat' }).getAttribute('href')).toBe(
      '/c/c-gone',
    );
    expect(within(activity).getByText('2.6k / 40')).toBeTruthy();
    expect(within(activity).getByText('0.9 s · 3.2 s')).toBeTruthy();
    expect(within(activity).getByText('In progress')).toBeTruthy();
    expect(within(activity).getByText('Done')).toBeTruthy();
    expect(within(activity).getByText('Stopped')).toBeTruthy();
    expect(within(activity).getByText('Slides')).toBeTruthy();
  });
});

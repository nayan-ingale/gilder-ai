import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadReceipt } from './load-receipt';

const gatewayGet = vi.fn<(path: string) => Promise<Response | null>>();
vi.mock('@/server/gateway-fetch', () => ({ gatewayGet: (path: string) => gatewayGet(path) }));
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect ${to}`);
});
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));

afterEach(() => {
  vi.clearAllMocks();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('loadReceipt', () => {
  it("asks billing for the order's receipt", async () => {
    gatewayGet.mockResolvedValue(json({ receipt: { orderId: 'order_A1', number: 'GA-2026-X' } }));

    expect(await loadReceipt('order_A1')).toMatchObject({ number: 'GA-2026-X' });
    expect(gatewayGet).toHaveBeenCalledWith('/api/billing/payments/order_A1');
  });

  it("is null for a missing, unpaid or someone else's order (billing answers 404 for all)", async () => {
    gatewayGet.mockResolvedValue(json({ code: 'not_found' }, 404));

    expect(await loadReceipt('order_theirs')).toBeNull();
  });

  it('is null without asking for anything that cannot be an order ID', async () => {
    expect(await loadReceipt('../plans')).toBeNull();
    expect(await loadReceipt('a'.repeat(65))).toBeNull();
    expect(gatewayGet).not.toHaveBeenCalled();
  });

  it('sends a visitor without a session to the sign-in page', async () => {
    gatewayGet.mockResolvedValueOnce(null).mockResolvedValueOnce(json({}, 401));

    await expect(loadReceipt('order_A1')).rejects.toThrow('redirect /login');
    await expect(loadReceipt('order_A1')).rejects.toThrow('redirect /login');
  });

  it('fails loudly on any other error', async () => {
    gatewayGet.mockResolvedValue(json({}, 503));

    await expect(loadReceipt('order_A1')).rejects.toThrow('the gateway answered 503');
  });
});

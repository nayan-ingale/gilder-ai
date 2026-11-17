import { redirect } from 'next/navigation';
import type { Receipt } from '@/lib/billing';
import { gatewayGet } from '@/server/gateway-fetch';

// Razorpay's order IDs (order_...); anything else can't be one, so skip the round trip.
const ORDER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A receipt for the server render of its page. Null when there is no such paid payment or it
 * isn't the user's (billing answers 404 for both). No session sends the visitor to /login.
 */
export async function loadReceipt(orderId: string): Promise<Receipt | null> {
  if (!ORDER_ID.test(orderId)) {
    return null;
  }
  const response = await gatewayGet(`/api/billing/payments/${orderId}`);
  if (!response || response.status === 401) {
    redirect('/login');
  }
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`the gateway answered ${response.status} for receipt ${orderId}`);
  }
  const { receipt } = (await response.json()) as { receipt: Receipt };
  return receipt;
}

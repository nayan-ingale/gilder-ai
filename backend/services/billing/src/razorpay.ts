import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '@gilder/shared';

/**
 * Razorpay, in test mode: orders are created by the server (the price comes from the plan
 * config, never from the browser), and every payment result is checked with Razorpay's HMAC
 * signature before anything is granted.
 */

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface PaymentGateway {
  /** The public key ID the browser's checkout needs. */
  keyId: string;
  createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder>;
  /** True when the checkout's signature for this order and payment is Razorpay's. */
  verifyCheckout(orderId: string, paymentId: string, signature: string): boolean;
  /** True when a webhook body was signed with the webhook secret. */
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
}

/** Compares two hex signatures in constant time, so timing reveals nothing about the right one. */
export function signaturesMatch(expectedHex: string, givenHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const given = Buffer.from(givenHex, /^[0-9a-f]+$/i.test(givenHex) ? 'hex' : 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const hmacHex = (secret: string, data: string | Buffer) =>
  createHmac('sha256', secret).update(data).digest('hex');

export interface RazorpaySettings {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export function createRazorpay(settings: RazorpaySettings): PaymentGateway {
  const auth = `Basic ${Buffer.from(`${settings.keyId}:${settings.keySecret}`).toString('base64')}`;
  return {
    keyId: settings.keyId,
    async createOrder({ amountPaise, receipt, notes }) {
      let response: Response;
      try {
        response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: { authorization: auth, 'content-type': 'application/json' },
          body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        throw new AppError('service_unavailable', 'Payments are not reachable right now', {
          cause: error,
        });
      }
      if (!response.ok) {
        throw new AppError('service_unavailable', `Payments answered ${response.status}`);
      }
      return (await response.json()) as RazorpayOrder;
    },
    verifyCheckout(orderId, paymentId, signature) {
      return signaturesMatch(hmacHex(settings.keySecret, `${orderId}|${paymentId}`), signature);
    },
    verifyWebhook(rawBody, signature) {
      return signaturesMatch(hmacHex(settings.webhookSecret, rawBody), signature);
    },
  };
}

/**
 * Razorpay's checkout, loaded only when someone buys. It opens Razorpay's own payment window;
 * this app never sees card details. The result (payment ID and signature) is checked by the
 * server before any credits are added.
 */

interface CheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface CheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (result: CheckoutResult) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => { open: () => void };
  }
}

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let loading: Promise<void> | undefined;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      reject(new Error('Could not load the payment window. Check your connection.'));
    };
    document.head.append(script);
  });
  return loading;
}

export interface CheckoutRequest {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  description: string;
}

/** Opens the payment window. Resolves with the result, or null if the user closed it. */
export async function openCheckout(
  request: CheckoutRequest,
): Promise<{ paymentId: string; signature: string } | null> {
  await loadCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    throw new Error('The payment window did not load.');
  }
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return new Promise((resolve) => {
    new Razorpay({
      key: request.keyId,
      amount: request.amountPaise,
      currency: request.currency,
      order_id: request.orderId,
      name: 'GilderAi',
      description: request.description,
      handler: (result) =>
        resolve({ paymentId: result.razorpay_payment_id, signature: result.razorpay_signature }),
      modal: { ondismiss: () => resolve(null) },
      theme: { color: accent || '#2d5be3' },
    }).open();
  });
}

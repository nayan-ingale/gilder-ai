import { randomUUID } from 'node:crypto';
import { AppError, type Logger, PLANS, rawBodyOf, requireUser, validate, z } from '@gilder/shared';
import { Router } from 'express';
import { grantPurchase } from './credits.ts';
import { PaymentModel, toAccount, toPayment, WebhookEventModel } from './models.ts';
import type { PaymentGateway } from './razorpay.ts';

/**
 * Buying credits: the plans, an order priced by the server, the browser's payment check, the
 * payment history, and Razorpay's webhook as a backup for a browser that closed too early.
 */

const PAID_PLANS = ['starter', 'pro'] as const;
const orderBody = z.object({ planId: z.enum(PAID_PLANS) }).strict();
const orderParams = z.object({ orderId: z.string().min(1).max(64) });
const verifyBody = z
  .object({
    paymentId: z.string().min(1).max(64),
    signature: z.string().min(1).max(256),
  })
  .strict();

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

export function paymentRouter(deps: {
  payments?: PaymentGateway | undefined;
  logger: Logger;
}): Router {
  const router = Router();
  const gateway = () => {
    if (!deps.payments) {
      throw new AppError('service_unavailable', 'Payments are not set up on this server');
    }
    return deps.payments;
  };

  router.get('/plans', requireUser(), (_req, res) => {
    res.json({
      plans: PAID_PLANS.map((id) => {
        const { name, pricePaise, credits, validityDays } = PLANS[id];
        return { id, name, pricePaise, credits, validityDays };
      }),
      currency: 'INR',
      testMode: true,
    });
  });

  // The price comes from the plan config; the browser only says which plan.
  router.post('/orders', requireUser(), validate({ body: orderBody }), async (req, res) => {
    const userId = res.locals.userId as string;
    const { planId } = req.body as z.output<typeof orderBody>;
    const plan = PLANS[planId];
    const payments = gateway();
    const order = await payments.createOrder({
      amountPaise: plan.pricePaise,
      receipt: `gilder_${randomUUID().slice(0, 18)}`,
      notes: { userId, planId },
    });
    await PaymentModel.create({
      userId,
      orderId: order.id,
      plan: planId,
      amountPaise: plan.pricePaise,
      credits: plan.credits,
    });
    res.status(201).json({
      order: { id: order.id, amountPaise: plan.pricePaise, currency: 'INR', planId },
      keyId: payments.keyId,
    });
  });

  // The browser's checkout result: checked with Razorpay's signature and the owner, then granted.
  router.post(
    '/orders/:orderId/verify',
    requireUser(),
    validate({ params: orderParams, body: verifyBody }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const { orderId } = req.params as z.output<typeof orderParams>;
      const { paymentId, signature } = req.body as z.output<typeof verifyBody>;
      if (!gateway().verifyCheckout(orderId, paymentId, signature)) {
        throw new AppError('bad_request', 'The payment could not be verified');
      }
      const { account, granted } = await grantPurchase({ orderId, paymentId, userId });
      res.json({ account: toAccount(account), granted });
    },
  );

  router.get('/payments', requireUser(), async (_req, res) => {
    const payments = await PaymentModel.find({ userId: res.locals.userId as string })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ items: payments.map(toPayment) });
  });

  // Razorpay calls this server to server. The signature over the raw body proves it is Razorpay;
  // the event ID makes a redelivery a no-op. Handled or not, it answers 200 so Razorpay stops.
  router.post('/webhooks/razorpay', async (req, res) => {
    const signature = req.get('x-razorpay-signature') ?? '';
    const rawBody = rawBodyOf(req);
    if (!rawBody || !gateway().verifyWebhook(rawBody, signature)) {
      throw new AppError('bad_request', 'The webhook signature is not valid');
    }
    const body = req.body as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    };
    const eventId = req.get('x-razorpay-event-id');
    if (eventId) {
      try {
        await WebhookEventModel.create({ _id: eventId, type: body.event ?? 'unknown' });
      } catch (error) {
        if (isDuplicateKey(error)) {
          res.json({ ok: true, duplicate: true });
          return;
        }
        throw error;
      }
    }

    const entity = body.payload?.payment?.entity;
    if (body.event === 'payment.captured' && entity?.id && entity.order_id) {
      try {
        const { granted } = await grantPurchase({ orderId: entity.order_id, paymentId: entity.id });
        deps.logger.info({ orderId: entity.order_id, granted }, 'payment webhook handled');
      } catch (error) {
        if (!(error instanceof AppError && error.code === 'not_found')) {
          throw error;
        }
        deps.logger.warn({ orderId: entity.order_id }, 'webhook for an unknown order');
      }
    }
    res.json({ ok: true });
  });

  return router;
}

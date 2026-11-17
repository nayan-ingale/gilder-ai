import { createHmac } from 'node:crypto';
import {
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  signInternalToken,
} from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { CREDIT_COSTS } from '@gilder/shared';
import { commitCredits, grantSignupCredits, reserveCredits } from './credits.ts';
import {
  AccountModel,
  LedgerModel,
  PaymentModel,
  ReservationModel,
  WebhookEventModel,
} from './models.ts';
import { createRazorpay, type PaymentGateway } from './razorpay.ts';

const KEY_SECRET = 'test-key-secret';
const WEBHOOK_SECRET = 'test-webhook-secret';
let mongo: TestMongo;
let gatewayKey: InternalKey;
let gatewayPublicKey: InternalKey;
let orderCount = 0;

/** Razorpay with real signature checks, and orders made locally instead of over the network. */
const payments: PaymentGateway = {
  ...createRazorpay({
    keyId: 'rzp_test_key',
    keySecret: KEY_SECRET,
    webhookSecret: WEBHOOK_SECRET,
  }),
  createOrder: async ({ amountPaise }) => {
    orderCount += 1;
    return { id: `order_test${orderCount}`, amount: amountPaise, currency: 'INR' };
  },
};

beforeAll(async () => {
  mongo = await startTestMongo({ replicaSet: true });
  await Promise.all([
    AccountModel.init(),
    ReservationModel.init(),
    LedgerModel.init(),
    PaymentModel.init(),
    WebhookEventModel.init(),
  ]);
  const pair = await generateInternalKeyPair();
  gatewayKey = await importInternalPrivateKey(pair.privateKey);
  gatewayPublicKey = await importInternalPublicKey(pair.publicKey);
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    AccountModel.deleteMany({}),
    ReservationModel.deleteMany({}),
    LedgerModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    WebhookEventModel.deleteMany({}),
  ]);
});

const app = (withPayments = true) =>
  createApp({
    logger: createLogger({ service: 'billing', level: 'silent' }),
    internalPublicKey: gatewayPublicKey,
    callerKeys: {},
    ...(withPayments ? { payments } : {}),
  });

async function as(userId: string | null) {
  const token = await signInternalToken(gatewayKey, 'billing', userId ? { userId } : {});
  const target = app();
  return {
    get: (path: string) => request(target).get(path).set(INTERNAL_TOKEN_HEADER, token),
    post: (path: string) => request(target).post(path).set(INTERNAL_TOKEN_HEADER, token),
  };
}

const checkoutSignature = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

function webhookBody(orderId: string, paymentId: string) {
  return JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: 19_900 } } },
  });
}

async function sendWebhook(body: string, eventId: string, signature?: string) {
  const token = await signInternalToken(gatewayKey, 'billing', {});
  return request(app())
    .post('/webhooks/razorpay')
    .set(INTERNAL_TOKEN_HEADER, token)
    .set('content-type', 'application/json')
    .set('x-razorpay-event-id', eventId)
    .set(
      'x-razorpay-signature',
      signature ?? createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex'),
    )
    .send(body);
}

/** The invariant: balance = sum of ledger entries − credits on hold. */
async function expectInvariant(userId: string) {
  const [account, entries, held] = await Promise.all([
    AccountModel.findById(userId),
    LedgerModel.find({ userId }),
    ReservationModel.find({ userId, status: 'held' }),
  ]);
  const ledgerSum = entries.reduce((sum, entry) => sum + entry.delta, 0);
  const heldSum = held.reduce((sum, hold) => sum + hold.amount, 0);
  expect(account?.balance).toBe(ledgerSum - heldSum);
}

async function newOrder(userId: string, planId: 'starter' | 'pro' = 'starter'): Promise<string> {
  const response = await (await as(userId)).post('/orders').send({ planId });
  return response.body.order.id as string;
}

describe('plans and orders', () => {
  it('lists the paid plans and prices an order on the server', async () => {
    const client = await as('u1');

    const plans = await client.get('/plans');
    const order = await client.post('/orders').send({ planId: 'pro' });
    const tampered = await client.post('/orders').send({ planId: 'pro', amountPaise: 1 });

    expect(plans.body.plans.map((plan: { id: string }) => plan.id)).toEqual(['starter', 'pro']);
    expect(order.status).toBe(201);
    expect(order.body).toMatchObject({
      order: { amountPaise: 49_900, currency: 'INR', planId: 'pro' },
      keyId: 'rzp_test_key',
    });
    expect(tampered.status).toBe(400);
    expect(await PaymentModel.findOne({ orderId: order.body.order.id })).toMatchObject({
      userId: 'u1',
      amountPaise: 49_900,
      credits: 1_000,
      status: 'created',
    });
  });

  it('lists the Free plan and the price of an answer from every agent, from the shared config', async () => {
    const plans = await (await as('u1')).get('/plans');

    expect(plans.body.freePlan).toEqual({ name: 'Free', credits: 100 });
    expect(plans.body.costs).toEqual(
      Object.entries(CREDIT_COSTS).map(([agent, credits]) => ({ agent, credits })),
    );
    expect(plans.body.costs[0]).toEqual({ agent: 'chat', credits: 1 });
    expect(plans.body.testMode).toBe(true);
  });

  it('answers 503 when payments are not set up', async () => {
    const token = await signInternalToken(gatewayKey, 'billing', { userId: 'u1' });

    const response = await request(app(false))
      .post('/orders')
      .set(INTERNAL_TOKEN_HEADER, token)
      .send({ planId: 'starter' });

    expect(response.status).toBe(503);
  });
});

describe('POST /orders/:orderId/verify', () => {
  it('grants the plan credits once for a correctly signed payment; a replay grants nothing (SEC-05)', async () => {
    await grantSignupCredits('u1');
    const orderId = await newOrder('u1');
    const client = await as('u1');
    const body = { paymentId: 'pay_1', signature: checkoutSignature(orderId, 'pay_1') };

    const first = await client.post(`/orders/${orderId}/verify`).send(body);
    const replay = await client.post(`/orders/${orderId}/verify`).send(body);

    expect(first.body).toMatchObject({ granted: true, account: { plan: 'starter', balance: 600 } });
    const expires = Date.parse(first.body.account.planExpiresAt as string);
    expect(expires - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(replay.body).toMatchObject({ granted: false, account: { balance: 600 } });
    expect(await LedgerModel.countDocuments({ userId: 'u1', kind: 'purchase' })).toBe(1);
    await expectInvariant('u1');
  });

  it("refuses a bad signature and someone else's order", async () => {
    const orderId = await newOrder('u1');

    const forged = await (
      await as('u1')
    )
      .post(`/orders/${orderId}/verify`)
      .send({ paymentId: 'pay_1', signature: 'f'.repeat(64) });
    const theirs = await (
      await as('u2')
    )
      .post(`/orders/${orderId}/verify`)
      .send({ paymentId: 'pay_1', signature: checkoutSignature(orderId, 'pay_1') });

    expect(forged.status).toBe(400);
    expect(theirs.status).toBe(404);
    expect(await AccountModel.countDocuments()).toBe(0);
  });
});

describe('POST /webhooks/razorpay', () => {
  it('grants a captured payment the browser never reported, and ignores a redelivery', async () => {
    const orderId = await newOrder('u1', 'pro');
    const body = webhookBody(orderId, 'pay_9');

    const first = await sendWebhook(body, 'evt_1');
    const again = await sendWebhook(body, 'evt_1');

    expect(first.body).toEqual({ ok: true });
    expect(again.body).toEqual({ ok: true, duplicate: true });
    expect((await AccountModel.findById('u1'))?.balance).toBe(1_000);
    await expectInvariant('u1');
  });

  it('grants nothing more after the browser already verified the payment (SEC-05)', async () => {
    const orderId = await newOrder('u1');
    await (
      await as('u1')
    )
      .post(`/orders/${orderId}/verify`)
      .send({ paymentId: 'pay_1', signature: checkoutSignature(orderId, 'pay_1') });

    await sendWebhook(webhookBody(orderId, 'pay_1'), 'evt_2');

    expect((await AccountModel.findById('u1'))?.balance).toBe(500);
    expect(await LedgerModel.countDocuments({ kind: 'purchase' })).toBe(1);
  });

  it('grants once when the browser and the webhook report the payment at the same time', async () => {
    const orderId = await newOrder('u1');
    const client = await as('u1');

    await Promise.all([
      client
        .post(`/orders/${orderId}/verify`)
        .send({ paymentId: 'pay_1', signature: checkoutSignature(orderId, 'pay_1') }),
      sendWebhook(webhookBody(orderId, 'pay_1'), 'evt_3'),
      sendWebhook(webhookBody(orderId, 'pay_1'), 'evt_4'),
    ]);

    expect((await AccountModel.findById('u1'))?.balance).toBe(500);
    expect(await LedgerModel.countDocuments({ kind: 'purchase' })).toBe(1);
    await expectInvariant('u1');
  });

  it('refuses a bad signature, and accepts events it does not act on', async () => {
    const orderId = await newOrder('u1');

    const forged = await sendWebhook(webhookBody(orderId, 'pay_1'), 'evt_5', '0'.repeat(64));
    const unknownOrder = await sendWebhook(webhookBody('order_nope', 'pay_2'), 'evt_6');
    const otherEvent = await sendWebhook(
      JSON.stringify({ event: 'order.paid', payload: {} }),
      'evt_7',
    );

    expect(forged.status).toBe(400);
    expect(unknownOrder.status).toBe(200);
    expect(otherEvent.status).toBe(200);
    expect(await AccountModel.countDocuments()).toBe(0);
  });
});

describe('payments and usage', () => {
  it("lists the user's paid payments, newest first, without abandoned checkouts", async () => {
    const client = await as('u1');
    for (const planId of ['starter', 'pro'] as const) {
      const orderId = await newOrder('u1', planId);
      const paymentId = `pay_${planId}`;
      await client
        .post(`/orders/${orderId}/verify`)
        .send({ paymentId, signature: checkoutSignature(orderId, paymentId) });
    }
    const abandoned = await newOrder('u1', 'starter');
    const theirs = await newOrder('u2');
    await (
      await as('u2')
    )
      .post(`/orders/${theirs}/verify`)
      .send({ paymentId: 'pay_theirs', signature: checkoutSignature(theirs, 'pay_theirs') });

    const response = await client.get('/payments');

    expect(
      response.body.items.map((payment: { plan: string; status: string }) => [
        payment.plan,
        payment.status,
      ]),
    ).toEqual([
      ['pro', 'paid'],
      ['starter', 'paid'],
    ]);
    // Still stored, so a late webhook can pay it.
    expect(await PaymentModel.countDocuments({ orderId: abandoned, status: 'created' })).toBe(1);
  });

  it('lists the sign-up grant with the payments, and null before it lands', async () => {
    const before = await (await as('u1')).get('/payments');
    await grantSignupCredits('u1');
    const after = await (await as('u1')).get('/payments');

    expect(before.body).toEqual({ items: [], signupGrant: null });
    expect(after.body.signupGrant).toMatchObject({ credits: 100 });
    expect(Date.parse(after.body.signupGrant.grantedAt as string)).toBeLessThanOrEqual(Date.now());
  });

  it("shows a receipt for the owner's paid payment only", async () => {
    const orderId = await newOrder('u1', 'pro');
    const client = await as('u1');
    const unpaid = await client.get(`/payments/${orderId}`);
    await client
      .post(`/orders/${orderId}/verify`)
      .send({ paymentId: 'pay_r1', signature: checkoutSignature(orderId, 'pay_r1') });

    const receipt = await client.get(`/payments/${orderId}`);
    const again = await client.get(`/payments/${orderId}`);
    const theirs = await (await as('u2')).get(`/payments/${orderId}`);
    const missing = await client.get('/payments/order_nope');

    expect(unpaid.status).toBe(404);
    expect(receipt.status).toBe(200);
    expect(receipt.body.receipt).toMatchObject({
      orderId,
      paymentId: 'pay_r1',
      plan: 'pro',
      planName: 'Pro',
      amountPaise: 49_900,
      credits: 1_000,
      status: 'paid',
      currency: 'INR',
      testMode: true,
    });
    expect(receipt.body.receipt.number).toMatch(/^GA-\d{4}-[0-9A-F]{8}$/);
    expect(again.body.receipt.number).toBe(receipt.body.receipt.number);
    expect(receipt.body.receipt.paidAt).not.toBeNull();
    // Someone else's order looks exactly like one that does not exist.
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(theirs.body.detail).toBe(missing.body.detail);
  });

  it('gives the median time to the first word, and marks running, finished and stopped answers', async () => {
    await grantSignupCredits('u1');
    for (const [key, firstTokenMs] of [
      ['turn-0000011', 900],
      ['turn-0000012', 100],
      ['turn-0000013', 300],
    ] as const) {
      const { reservation } = await reserveCredits({
        userId: 'u1',
        agent: 'chat',
        idempotencyKey: key,
      });
      await commitCredits('u1', reservation.id, { latencyMs: 2_000, firstTokenMs, chatId: 'c1' });
    }
    // Stopped after it started: charged, with no timing.
    const stopped = await reserveCredits({
      userId: 'u1',
      agent: 'search',
      idempotencyKey: 'turn-0000014',
    });
    await commitCredits('u1', stopped.reservation.id, { chatId: 'c1' });
    // Still running: its credits are on hold.
    await reserveCredits({ userId: 'u1', agent: 'code', idempotencyKey: 'turn-0000015' });
    const client = await as('u1');

    const summary = await client.get('/usage/summary?days=7');
    const events = await client.get('/usage/events');
    const older = await client.get(
      `/usage/events?before=${new Date(Date.now() + 1000).toISOString()}`,
    );
    const empty = await (await as('u2')).get('/usage/summary?days=90');

    expect(summary.body).toMatchObject({
      totalCredits: 8,
      totalAnswers: 4,
      medianFirstTokenMs: 300,
    });
    expect(
      events.body.items.map((item: { agent: string; status: string }) => [item.agent, item.status]),
    ).toEqual([
      ['code', 'running'],
      ['search', 'stopped'],
      ['chat', 'done'],
      ['chat', 'done'],
      ['chat', 'done'],
    ]);
    expect(events.body.items[0]).toMatchObject({ credits: 10, chatId: null, latencyMs: null });
    // Paging back lists charged answers only.
    expect(older.body.items).toHaveLength(4);
    expect(empty.body).toMatchObject({ days: 90, totalAnswers: 0, medianFirstTokenMs: null });
  });

  it('sums credits by agent and by day, and lists the latest answers', async () => {
    await grantSignupCredits('u1');
    for (const [agent, key] of [
      ['chat', 'turn-0000001'],
      ['search', 'turn-0000002'],
      ['chat', 'turn-0000003'],
    ] as const) {
      const { reservation } = await reserveCredits({ userId: 'u1', agent, idempotencyKey: key });
      await commitCredits('u1', reservation.id, {
        model: 'm',
        outputTokens: 10,
        latencyMs: 500,
        firstTokenMs: 120,
      });
    }
    const client = await as('u1');

    const summary = await client.get('/usage/summary?days=7');
    const events = await client.get('/usage/events?limit=2');

    expect(summary.body).toMatchObject({
      days: 7,
      totalCredits: 7,
      byAgent: [
        { agent: 'search', credits: 5, answers: 1 },
        { agent: 'chat', credits: 2, answers: 2 },
      ],
    });
    expect(summary.body.byDay).toEqual([
      { date: new Date().toISOString().slice(0, 10), credits: 7 },
    ]);
    // Days follow the viewer's time zone; an unknown zone is refused.
    const kolkata = await client.get('/usage/summary?days=7&tz=Asia/Kolkata');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    expect(kolkata.body.byDay).toEqual([{ date: today, credits: 7 }]);
    expect((await client.get('/usage/summary?tz=Mars/Base')).status).toBe(400);
    expect(events.body.items).toHaveLength(2);
    expect(events.body.items[0]).toMatchObject({
      agent: 'chat',
      credits: 1,
      model: 'm',
      outputTokens: 10,
      latencyMs: 500,
      firstTokenMs: 120,
    });
  });
});

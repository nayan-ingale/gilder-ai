import type { Flow, FlowStep, SymbolRef } from '../schema.ts';

/**
 * Buying credits and the usage page: an order priced by the server, Razorpay's checkout, the
 * signed result checked by billing (from the browser, or from Razorpay's webhook as a backup),
 * one grant whoever reports the payment first, and the usage numbers read from the ledger.
 */

const BILLING_VIEW: SymbolRef = 'frontend/src/components/billing/billing-view.tsx#BillingView';
const PAYMENTS: SymbolRef = 'backend/services/billing/src/payment-routes.ts#paymentRouter';
const USAGE: SymbolRef = 'backend/services/billing/src/usage-routes.ts#usageRouter';
const GRANT: SymbolRef = 'backend/services/billing/src/credits.ts#grantPurchase';
const RAZORPAY: SymbolRef = 'backend/services/billing/src/razorpay.ts#createRazorpay';
const GATEWAY_APP: SymbolRef = 'backend/gateway/src/app.ts#createApp';

const TESTS =
  "payments.test.ts runs billing's routes on a real MongoDB with real signature checks and orders made locally; billing.test.tsx follows the browser's side with the checkout stubbed.";

function gatewayToBilling(route: string, target: string, safe: boolean): FlowStep {
  return {
    id: 'gateway',
    title: 'Next.js server and gateway: forward to billing',
    kind: 'middleware',
    status: 'verified',
    symbol: GATEWAY_APP,
    highlight: 'const matched = matchRoute(req.method, req.path);',
    what: `The app's /api route forwards the request to the gateway (forwardToGateway), which counts it for the per-IP limit, finds ${route} in its table (service billing, target ${target}, session required), ${safe ? 'lets a GET through the Origin check' : 'checks the Origin'}, looks the session up, counts it for the per-user limit and requires a session. proxyToService signs a token for billing that names the user.`,
    why: 'The browser never talks to billing directly, and the gateway proves who is asking.',
  };
}

// ---------------------------------------------------------------------------------------------
// Buy credits

const buyCredits: Flow = {
  id: 'buy-credits',
  title: 'Buy credits',
  category: 'api',
  apps: ['frontend', 'gateway', 'billing'],
  summary: `A plan bought on the billing page, in Razorpay's test mode. The page lists the paid plans; Buy asks billing for an order, which billing prices from its own plan config and creates at Razorpay, then saves as a payment marked created. The browser opens Razorpay's checkout, which handles the card or UPI details itself and hands back a payment ID and a signature. The browser sends those to billing, which checks the signature with its key secret and that the order is the user's, then grants the credits in one transaction: the payment marked paid, a purchase ledger entry, the balance and a 30-day plan badge. The same grant runs when Razorpay's webhook reports the payment (see POST /webhooks/razorpay); whichever comes second changes nothing. ${TESTS}`,
  status: 'verified',
  steps: [
    {
      id: 'open',
      title: 'The user opens Billing',
      kind: 'trigger',
      status: 'verified',
      symbol: BILLING_VIEW,
      highlight: 'const plans = useGetPlansQuery();',
      what: "The account menu's 'Billing', or the credits card in the sidebar, opens /settings/billing, under the Settings tabs. BillingView loads three things at once: the account (GET /api/billing/account), the plans (GET /api/billing/plans) and the payment history (GET /api/billing/payments). A note says only test payments are taken, with a Razorpay test card or the test UPI ID success@razorpay.",
      why: 'The user sees their balance, what they can buy and what they bought, in one place.',
    },
    {
      id: 'plans',
      title: 'Billing lists the paid plans',
      kind: 'handler',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: "router.get('/plans', requireUser(), (_req, res) => {",
      what: 'GET /plans answers Starter and Pro from the shared PLANS config, each with its name, price in paise, credits and validity days, plus currency INR and testMode true. The page shows the prices in rupees (formatRupees).',
      why: 'The prices shown come from the same config the order is priced from.',
      output:
        '{ "plans": [{ "id": "starter", "name": "Starter", "pricePaise": 19900, "credits": 500, "validityDays": 30 }, ...], "currency": "INR", "testMode": true }',
    },
    {
      id: 'buy',
      title: 'Buy: ask for an order',
      kind: 'function',
      status: 'verified',
      symbol: BILLING_VIEW,
      highlight: 'const { order, keyId } = await createOrder({ planId: plan.id }).unwrap();',
      what: "Clicking a plan's button ('Upgrade to Starter', 'Buy again' and so on) turns every plan button off and shows 'Opening payment…'. createOrder posts { planId } to /api/billing/orders: the browser names the plan, never a price.",
      why: 'One purchase at a time, and the browser never chooses the amount.',
      input: 'POST /api/billing/orders, { "planId": "starter" }',
    },
    gatewayToBilling('POST /api/billing/orders', '/orders', false),
    {
      id: 'order-route',
      title: 'Billing: check the body',
      kind: 'handler',
      status: 'verified',
      symbol: PAYMENTS,
      highlight:
        "router.post('/orders', requireUser(), validate({ body: orderBody }), async (req, res) => {",
      what: "The body must be exactly { planId: 'starter' | 'pro' }; it is strict, so a body that adds an amount or a price is a 400. When billing runs without its Razorpay settings, the route answers 503 'Payments are not set up on this server'.",
      why: 'The price comes from the plan config on the server (PLANS), so it cannot be changed from the browser.',
      next: [
        { to: 'razorpay-order', kind: 'next' },
        { to: 'failed', kind: 'error', label: '400 bad body, or 503 payments off' },
      ],
    },
    {
      id: 'razorpay-order',
      title: 'Create the order at Razorpay',
      kind: 'external',
      status: 'verified',
      symbol: RAZORPAY,
      highlight: "response = await fetch('https://api.razorpay.com/v1/orders', {",
      what: "createOrder posts the plan's price in paise, the currency INR, a receipt (gilder_ and a random ID) and notes with the user and the plan to Razorpay's orders API, with the key ID and secret as Basic auth and a 10-second limit. No answer, or an error status, is a 503 ('Payments are not reachable right now', or 'Payments answered <status>').",
      why: "Razorpay's checkout only takes an order the server made, with the amount fixed.",
      next: [
        { to: 'save-payment', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'Razorpay unreachable or refusing' },
      ],
    },
    {
      id: 'save-payment',
      title: 'Save the payment as created',
      kind: 'datastore',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: 'await PaymentModel.create({',
      what: "A Payment record keeps the user, Razorpay's order ID (unique), the plan, the amount and the credits, with status created. Billing answers 201 with the order (ID, amount, currency, plan) and the public key ID the checkout needs.",
      why: 'The grant later reads the credits from this record, not from anything the browser or Razorpay sends.',
      sideEffects: ['Creates a payment in MongoDB.'],
      output:
        '201 { "order": { "id": "order_...", "amountPaise": 19900, "currency": "INR", "planId": "starter" }, "keyId": "rzp_test_..." }',
    },
    {
      id: 'checkout',
      title: "Open Razorpay's checkout",
      kind: 'external',
      status: 'verified',
      symbol: 'frontend/src/lib/razorpay-checkout.ts#openCheckout',
      highlight: 'new Razorpay({',
      what: "openCheckout loads Razorpay's checkout.js the first time someone buys (loadCheckout adds the script once and lets a failed load be tried again), then opens Razorpay's payment window with the key ID, the amount, the order ID, the plan as the description and the app's accent colour. Card and UPI details go to Razorpay only. On success it resolves with the payment ID and Razorpay's signature; closing the window resolves with null.",
      why: 'The payment script loads only for people who buy, and the app never handles payment details.',
      next: [
        { to: 'verify-call', kind: 'next' },
        { to: 'closed', kind: 'branch', label: 'the window was closed' },
      ],
    },
    {
      id: 'verify-call',
      title: 'Send the result to billing',
      kind: 'function',
      status: 'verified',
      symbol: BILLING_VIEW,
      highlight:
        'const { granted } = await verifyPayment({ orderId: order.id, ...result }).unwrap();',
      what: 'verifyPayment posts { paymentId, signature } to /api/billing/orders/<order ID>/verify. The Next.js server and the gateway forward it the same way as the order (POST /api/billing/orders/:orderId/verify, target /orders/:orderId/verify, Origin checked, session required).',
      why: "The browser only passes Razorpay's result on; billing decides whether it is real.",
      input:
        'POST /api/billing/orders/<order ID>/verify, { "paymentId": "pay_...", "signature": "..." }',
    },
    {
      id: 'check-signature',
      title: "Billing: check Razorpay's signature",
      kind: 'handler',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: 'if (!gateway().verifyCheckout(orderId, paymentId, signature)) {',
      what: "The body is strict (a payment ID up to 64 characters and a signature up to 256). verifyCheckout computes an HMAC-SHA256 of '<order ID>|<payment ID>' with the key secret and compares it with the signature in constant time (signaturesMatch). A wrong signature is a 400 'The payment could not be verified'.",
      why: 'Only Razorpay knows the key secret, so a matching signature proves this payment was made for this order. A made-up payment ID cannot pass.',
      next: [
        { to: 'owner', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'a bad signature' },
      ],
    },
    {
      id: 'owner',
      title: "The order must be the user's",
      kind: 'datastore',
      status: 'verified',
      symbol: GRANT,
      highlight:
        'if (!existing || (input.userId !== undefined && existing.userId !== input.userId)) {',
      what: "grantPurchase finds the payment by its order ID. When the browser reports it, the payment must belong to the signed-in user; otherwise, or when there is no such order, it is a 404 'No such order'.",
      why: "A correctly signed payment for someone else's order cannot be claimed by another account.",
      next: [
        { to: 'grant', kind: 'next' },
        { to: 'failed', kind: 'error', label: "404: no such order, or someone else's" },
      ],
    },
    {
      id: 'grant',
      title: 'Grant once, in one transaction',
      kind: 'datastore',
      status: 'verified',
      symbol: GRANT,
      highlight: "{ orderId: input.orderId, status: 'created' },",
      what: "In one transaction: the payment goes from created to paid with the payment ID and paidAt, but only if it is still created; a purchase ledger entry adds the plan's credits; the balance goes up; and the plan becomes the bought one, with planExpiresAt 30 days on from now, or from the current end if the badge is still running. If the payment was already paid, nothing changes and granted is false. If two reports race, the unique payment ID on the ledger (one_purchase_per_payment) keeps one grant and the other ends with granted false.",
      why: 'The browser and the webhook may both report the same payment, in any order or at the same moment; the credits must arrive exactly once (SEC-05).',
      sideEffects: [
        'Marks the payment paid, appends a purchase ledger entry and updates the account, in MongoDB.',
      ],
    },
    {
      id: 'answer',
      title: 'Billing answers with the account',
      kind: 'response',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: 'res.json({ account: toAccount(account), granted });',
      what: 'The body is the account as it now is (plan, planExpiresAt, balance) and whether this call granted the credits.',
      why: 'The page can tell a fresh grant from a payment the webhook already added.',
      output:
        '200 { "account": { "plan": "starter", "planExpiresAt": "...", "balance": 600 }, "granted": true }',
    },
    {
      id: 'toast',
      title: 'The page says the credits arrived',
      kind: 'response',
      status: 'verified',
      symbol: BILLING_VIEW,
      highlight: 'title: granted',
      what: "A toast says '<credits> credits added', or 'Payment already added' when granted is false, and that the plan is active for its days. verifyPayment invalidates the Account and Payment tags, so the balance, the credits card and the payment history load again.",
      why: 'The new balance shows everywhere without a reload.',
      next: [],
    },
    {
      id: 'closed',
      title: 'The window was closed: nothing more',
      kind: 'response',
      status: 'verified',
      symbol: BILLING_VIEW,
      highlight: 'if (!result) {',
      what: 'Nothing is sent and no toast shows; the Buy buttons come back. The payment stays created and is left out of the history; a late webhook can still pay it, and then it shows.',
      why: 'Closing the payment window is a choice, not an error.',
      next: [],
    },
    {
      id: 'failed',
      title: 'The page says the payment did not go through',
      kind: 'error',
      status: 'verified',
      symbol: BILLING_VIEW,
      highlight: "title: 'The payment did not go through',",
      what: "A refused order or check comes back as problem+json, and the toast shows its message and request ID. A checkout script that fails to load shows 'Could not load the payment window. Check your connection.'",
      why: 'The user learns why, and the request ID links the toast to the server logs.',
      next: [],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// The payment webhook

const paymentWebhook: Flow = {
  id: 'payment-webhook',
  title: 'POST /webhooks/razorpay',
  category: 'api',
  route: { method: 'POST', path: '/webhooks/razorpay' },
  apps: ['frontend', 'gateway', 'billing'],
  summary:
    "Razorpay's report that a payment was captured, server to server: the backup for a browser that closed before it could report the payment itself. It reaches the app's public /api/webhooks/razorpay. The Next.js server and the gateway pass its body unchanged with its two Razorpay headers; the gateway skips the Origin check for this route only, since no browser sends it. Billing checks the signature over the exact body bytes, records the event ID so a redelivery does nothing, and grants a captured payment with the same idempotent grant as the browser's check. It answers 200 for anything correctly signed, so Razorpay stops retrying. payments.test.ts covers a webhook alone, a redelivery, a webhook after the browser's check, the browser and the webhook at the same moment, bad signatures and other events; the gateway's app.test.ts covers the route.",
  status: 'verified',
  steps: [
    {
      id: 'razorpay',
      title: 'Razorpay calls the webhook',
      kind: 'trigger',
      status: 'verified',
      what: "Razorpay posts the event as JSON to the app's /api/webhooks/razorpay, with x-razorpay-signature (an HMAC-SHA256 of the body with the webhook secret) and x-razorpay-event-id. Locally, RAZORPAY_WEBHOOK_SECRET can be any long random string.",
      why: "The browser's check can be lost if the tab closes right after paying; Razorpay's report still arrives.",
      input:
        'POST /api/webhooks/razorpay, { "event": "payment.captured", "payload": { "payment": { "entity": { "id": "pay_...", "order_id": "order_..." } } } }',
    },
    {
      id: 'next-proxy',
      title: 'Next.js server: pass the signature headers on',
      kind: 'middleware',
      status: 'verified',
      symbol: 'frontend/src/server/gateway-proxy.ts#FORWARDED_REQUEST_HEADERS',
      highlight: "'x-razorpay-signature',",
      what: "The /api route forwards the request to the gateway (forwardToGateway) with the body as it came and the allowed headers, which include x-razorpay-signature and x-razorpay-event-id. It has no cookie or Origin, since Razorpay's server sent it.",
      why: 'The signature must reach billing along with the exact body it signs.',
    },
    {
      id: 'gw-match',
      title: 'Gateway: a webhook route, no session',
      kind: 'middleware',
      status: 'verified',
      symbol: GATEWAY_APP,
      highlight: 'const matched = matchRoute(req.method, req.path);',
      what: 'The per-IP limit counts it, and the route table matches POST /api/webhooks/razorpay: service billing, target /webhooks/razorpay, session none, and webhook headers x-razorpay-signature and x-razorpay-event-id. The session lookup finds no cookie, and no session is required.',
      why: 'Only this one path is open without a session, and only to be checked by its signature.',
    },
    {
      id: 'gw-origin',
      title: 'Gateway: no Origin check for a webhook',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#originCheck',
      highlight: 'if (SAFE_METHODS.has(req.method) || matched?.route.webhook) {',
      what: 'originCheck lets a route marked webhook through without an Origin header. Every other POST still needs an allowed Origin (the tests check both).',
      why: 'A server-to-server call has no browser Origin. The signature check in billing takes the place of the Origin check here.',
    },
    {
      id: 'gw-proxy',
      title: 'Gateway: forward the raw body and the two headers',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/gateway/src/proxy.ts#proxyToService',
      highlight:
        'for (const name of [...FORWARDED_REQUEST_HEADERS, ...(matched.route.webhook?.headers ?? [])]) {',
      what: "express.raw reads the body as bytes (up to 1 MB) and proxyToService sends them to billing unchanged, with the usual few headers plus this route's two webhook headers, and a token for billing that names no user.",
      why: 'The gateway never parses or rewrites a body, so the bytes billing checks are the bytes Razorpay signed. The webhook headers go to this route only.',
    },
    {
      id: 'raw-body',
      title: 'Billing: parse the JSON and keep the bytes',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/shared/src/service.ts#createService',
      highlight: '(req as RawBodyRequest).rawBody = buffer;',
      what: "express.json parses the body, and its verify hook keeps the exact bytes on the request, which rawBodyOf reads. Then billing's internal-token check accepts the gateway's token (it names no user, and this route does not need one).",
      why: 'A signature is over the exact bytes; JSON parsed and written out again may not match them.',
    },
    {
      id: 'signature',
      title: 'Billing: check the webhook signature',
      kind: 'handler',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: 'if (!rawBody || !gateway().verifyWebhook(rawBody, signature)) {',
      what: 'verifyWebhook computes an HMAC-SHA256 of the raw body with RAZORPAY_WEBHOOK_SECRET and compares it with x-razorpay-signature in constant time. A missing or wrong signature is a 400; with payments off it is a 503.',
      why: 'Anyone can reach this public path; only Razorpay can sign a body with the webhook secret.',
      next: [
        { to: 'dedupe', kind: 'next' },
        { to: 'bad-signature', kind: 'error', label: 'no body, or a bad signature' },
      ],
    },
    {
      id: 'dedupe',
      title: 'Record the event ID once',
      kind: 'datastore',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: "await WebhookEventModel.create({ _id: eventId, type: body.event ?? 'unknown' });",
      what: 'When x-razorpay-event-id is present, the event ID is saved as the _id of a webhookEvents record with the event type. A redelivery of the same event hits the duplicate key and gets 200 { ok: true, duplicate: true } without doing anything else.',
      why: 'Razorpay delivers at least once and retries; the event ID turns a repeat into a no-op.',
      sideEffects: ['Creates a webhookEvents record in MongoDB.'],
      next: [
        { to: 'captured', kind: 'next' },
        { to: 'duplicate', kind: 'branch', label: 'this event was handled before' },
      ],
    },
    {
      id: 'captured',
      title: 'Act only on payment.captured',
      kind: 'function',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: "if (body.event === 'payment.captured' && entity?.id && entity.order_id) {",
      what: 'A payment.captured event with a payment ID and an order ID goes on to the grant. Any other event is accepted and ignored.',
      why: 'Only a captured payment has money behind it.',
      next: [
        { to: 'grant', kind: 'branch', label: 'payment.captured' },
        { to: 'answer', kind: 'branch', label: 'any other event' },
      ],
    },
    {
      id: 'grant',
      title: "Grant once, for the order's owner",
      kind: 'datastore',
      status: 'verified',
      symbol: GRANT,
      highlight: "{ orderId: input.orderId, status: 'created' },",
      what: "grantPurchase runs without a user: the owner comes from the payment record. It is the same transaction as the browser's check (see Buy credits), so a payment the browser already reported changes nothing. Billing logs 'payment webhook handled' with the order and whether it granted.",
      why: 'One grant path for both reporters means the credits arrive once, whoever is first (SEC-05).',
      sideEffects: [
        'Marks the payment paid, appends a purchase ledger entry and updates the account, in MongoDB.',
      ],
      next: [
        { to: 'answer', kind: 'next' },
        { to: 'unknown-order', kind: 'branch', label: 'no payment with this order ID' },
      ],
    },
    {
      id: 'unknown-order',
      title: 'An order billing never made: log it',
      kind: 'function',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: "deps.logger.warn({ orderId: entity.order_id }, 'webhook for an unknown order');",
      what: "grantPurchase's 404 is caught and logged at warn; the webhook still answers 200. Any other failure is thrown and becomes a 5xx, so Razorpay retries.",
      why: 'Retrying an order billing does not know would never help; a database failure might.',
      sideEffects: ['Logs a warn line in billing.'],
    },
    {
      id: 'answer',
      title: 'Answer 200',
      kind: 'response',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: 'res.json({ ok: true });',
      what: 'Handled or ignored, a correctly signed event gets 200 { ok: true }.',
      why: 'Razorpay stops delivering an event once it gets a 2xx.',
      output: '200 { "ok": true }',
      next: [],
    },
    {
      id: 'duplicate',
      title: 'A redelivery: answer 200 and stop',
      kind: 'response',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: 'res.json({ ok: true, duplicate: true });',
      what: 'Nothing else runs for an event already recorded.',
      why: 'The first delivery did the work.',
      output: '200 { "ok": true, "duplicate": true }',
      next: [],
    },
    {
      id: 'bad-signature',
      title: 'A bad signature: 400',
      kind: 'error',
      status: 'verified',
      symbol: PAYMENTS,
      highlight: "throw new AppError('bad_request', 'The webhook signature is not valid');",
      what: 'Nothing is recorded or granted, and the answer is problem+json with status 400.',
      why: 'A forged or altered body changes nothing.',
      next: [],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// The usage page

const usageSummary: Flow = {
  id: 'usage-summary',
  title: 'GET /usage/summary',
  category: 'api',
  route: { method: 'GET', path: '/usage/summary' },
  apps: ['frontend', 'gateway', 'billing'],
  summary:
    "The usage page. It asks billing for the last 30 days of usage in the viewer's own time zone; billing sums the user's usage ledger entries by agent and by calendar day in that zone. The page fills in the quiet days, so the last column is the viewer's today, and draws the days as columns in the chart colour, with the same numbers in a table for screen readers. Beside it, GET /usage/events lists the latest answers with their model, tokens and time taken. A finished answer invalidates the Usage tag, so the numbers load again. payments.test.ts covers both routes, daily-chart.test.ts the days, axis and tooltip, and billing.test.tsx the page.",
  status: 'verified',
  steps: [
    {
      id: 'open',
      title: 'The user opens Usage',
      kind: 'trigger',
      status: 'verified',
      symbol: 'frontend/src/components/billing/usage-view.tsx#UsageView',
      highlight:
        "const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');",
      what: "The account menu's Usage opens /settings/usage. UsageView reads the browser's time zone once and asks for the summary (30 days, that zone) and the latest answers at the same time.",
      why: "Days are counted on the viewer's own clock, so today on the chart is their today.",
    },
    {
      id: 'query',
      title: 'Ask for the summary',
      kind: 'external',
      status: 'verified',
      symbol: 'frontend/src/store/api.ts#api',
      highlight: '`/usage/summary?days=${days}&tz=${encodeURIComponent(timeZone)}`,',
      what: 'getUsageSummary sends GET /api/usage/summary?days=30&tz=<zone>. It provides the Usage tag, which a finished answer in the chat thread invalidates.',
      why: 'The page stays current after the user spends credits elsewhere in the app.',
      input: 'GET /api/usage/summary?days=30&tz=Asia%2FKolkata',
    },
    gatewayToBilling('GET /api/usage/summary', '/usage/summary', true),
    {
      id: 'validate',
      title: 'Billing: check the window and the time zone',
      kind: 'handler',
      status: 'verified',
      symbol: USAGE,
      highlight: 'validate({ query: summaryQuery }),',
      what: 'days must be a whole number from 1 to 90 (30 when left out). tz must be a time zone the runtime knows (isTimeZone), aliases such as Asia/Kolkata included, and is UTC when left out. Anything else is a 400 validation_failed.',
      why: 'The zone goes into the database query, so only real zone names get that far.',
    },
    {
      id: 'aggregate',
      title: 'Sum the usage by agent and by day',
      kind: 'datastore',
      status: 'verified',
      symbol: USAGE,
      highlight:
        "_id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },",
      what: "Two aggregations run at once over the user's usage ledger entries in the window: one groups by the agent in the entry's metadata (credits, the negated deltas, and the number of answers, largest first); the other by calendar day in the viewer's zone.",
      why: 'The ledger already holds every charge with its agent, so the usage page needs no table of its own.',
    },
    {
      id: 'answer',
      title: 'Billing answers with the totals',
      kind: 'response',
      status: 'verified',
      symbol: USAGE,
      highlight: 'totalCredits: byAgent.reduce((sum, row) => sum + row.credits, 0),',
      what: 'The body has the window, the total credits, the agents (an entry without an agent counts as chat) and the days that had usage.',
      why: 'Days without usage are left out; the page fills them in.',
      output:
        '200 { "days": 30, "totalCredits": 14, "byAgent": [{ "agent": "code", "credits": 8, "answers": 2 }, ...], "byDay": [{ "date": "2026-11-08", "credits": 6 }, ...] }',
    },
    {
      id: 'fill-days',
      title: "Fill in every day, ending on the viewer's today",
      kind: 'function',
      status: 'verified',
      symbol: 'frontend/src/components/billing/daily-chart.tsx#fillDays',
      highlight: "const localToday = new Intl.DateTimeFormat('en-CA', { timeZone }).format(today);",
      what: "fillDays works out today's date in the viewer's zone and returns every day of the window, oldest first, with 0 for a day billing did not list.",
      why: "Late in the evening in India it is already tomorrow in UTC; counting in the viewer's zone keeps the last column on their today.",
    },
    {
      id: 'chart',
      title: 'Draw the columns, the agents and the table',
      kind: 'response',
      status: 'verified',
      symbol: 'frontend/src/components/billing/daily-chart.tsx#DailyChart',
      highlight: '<table className="sr-only">',
      what: 'DailyChart draws one column per day in the --chart-bar colour, from a rounded axis top (niceMax). Hovering a day shows its value in a tooltip kept inside the chart (tooltipPosition). The page also shows the total credits and answers, a bar per agent and a table of the latest answers.',
      why: 'One series needs no legend; the heading names it. The hidden table gives screen readers the same numbers.',
      next: [],
    },
  ],
};

export const paymentFlows: Flow[] = [buyCredits, paymentWebhook, usageSummary];

import {
  AGENTS,
  type HydratedDocument,
  type InferSchemaType,
  mongoose,
  PLANS,
  type PlanId,
} from '@gilder/shared';

/**
 * The billing service's data, in its own database (gilder_billing): one account per user, the
 * credits held for answers in progress, and an append-only ledger of every credit change.
 *
 * Invariant, checked by the tests: an account's balance equals the sum of its ledger entries
 * minus the credits it has on hold.
 */

const { Schema } = mongoose;

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const RESERVATION_STATUSES = ['held', 'committed', 'released'] as const;
export const LEDGER_KINDS = ['signup_grant', 'purchase', 'usage', 'adjustment'] as const;
export const PAYMENT_STATUSES = ['created', 'paid'] as const;

const wholeCredits = {
  validator: Number.isInteger,
  message: 'Credits are whole numbers',
};

const accountSchema = new Schema(
  {
    /** The user's ID from auth: one account per user. */
    _id: { type: String, required: true },
    plan: { type: String, enum: PLAN_IDS, required: true, default: 'free' },
    /** When a paid plan's badge ends. Purchased credits never expire. */
    planExpiresAt: { type: Date, default: null },
    /** Never below 0: every spend is a conditional update on `balance >= cost`. */
    balance: { type: Number, required: true, min: 0, default: 0, validate: wholeCredits },
  },
  { timestamps: true },
);

const reservationSchema = new Schema(
  {
    userId: { type: String, required: true },
    amount: { type: Number, required: true, min: 1, validate: wholeCredits },
    agent: { type: String, enum: AGENTS, required: true },
    status: { type: String, enum: RESERVATION_STATUSES, required: true, default: 'held' },
    /** Chosen by the caller, so a retried reserve holds the credits only once. */
    idempotencyKey: { type: String, required: true, maxlength: 128 },
  },
  { timestamps: true },
);
reservationSchema.index({ idempotencyKey: 1 }, { unique: true });
// The sweeper looks for reservations still held after a while.
reservationSchema.index({ status: 1, createdAt: 1 });

const ledgerSchema = new Schema(
  {
    userId: { type: String, required: true },
    /** Credits added (positive) or spent (negative). Never 0. */
    delta: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value !== 0,
        message: 'A ledger entry changes the balance by a whole, non-zero number of credits',
      },
    },
    kind: { type: String, enum: LEDGER_KINDS, required: true },
    reservationId: { type: Schema.Types.ObjectId, default: null },
    paymentId: { type: String, default: null },
    /** For usage: agent, model, tokens and latency. */
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ledger' },
);
ledgerSchema.index({ userId: 1, createdAt: -1 });
// One sign-up grant per user, even when two sign-ins race.
ledgerSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { kind: 'signup_grant' }, name: 'one_signup_grant' },
);
// One usage entry per reservation, so a retried commit can't charge twice.
ledgerSchema.index(
  { reservationId: 1 },
  { unique: true, partialFilterExpression: { kind: 'usage' }, name: 'one_usage_per_reservation' },
);

// One purchase entry per payment, so a payment verified twice (by the browser and the webhook)
// grants its credits once.
ledgerSchema.index(
  { paymentId: 1 },
  { unique: true, partialFilterExpression: { kind: 'purchase' }, name: 'one_purchase_per_payment' },
);

const paymentSchema = new Schema(
  {
    userId: { type: String, required: true },
    /** Razorpay's order, made by the server with the price from the plan config. */
    orderId: { type: String, required: true },
    /** Set once paid. Unique, so a payment can't be used twice. */
    paymentId: { type: String },
    plan: { type: String, enum: PLAN_IDS, required: true },
    amountPaise: { type: Number, required: true, min: 1, validate: wholeCredits },
    credits: { type: Number, required: true, min: 1, validate: wholeCredits },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'created' },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);
paymentSchema.index({ orderId: 1 }, { unique: true });
paymentSchema.index(
  { paymentId: 1 },
  { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } },
);
paymentSchema.index({ userId: 1, createdAt: -1 });

/** Webhook deliveries already handled, by Razorpay's event ID, so a redelivery does nothing. */
const webhookEventSchema = new Schema(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true },
  },
  { timestamps: { createdAt: 'receivedAt', updatedAt: false }, collection: 'webhookEvents' },
);

export type Account = InferSchemaType<typeof accountSchema>;
export type AccountDocument = HydratedDocument<Account>;
export type Reservation = InferSchemaType<typeof reservationSchema>;
export type ReservationDocument = HydratedDocument<Reservation>;
export type LedgerEntry = InferSchemaType<typeof ledgerSchema>;

export const AccountModel = mongoose.model('Account', accountSchema);
export const ReservationModel = mongoose.model('Reservation', reservationSchema);
export const LedgerModel = mongoose.model('LedgerEntry', ledgerSchema);
export const PaymentModel = mongoose.model('Payment', paymentSchema);
export const WebhookEventModel = mongoose.model('WebhookEvent', webhookEventSchema);

export type Payment = InferSchemaType<typeof paymentSchema>;
export type PaymentDocument = HydratedDocument<Payment>;

/** What the API shows of a payment. */
export interface PaymentView {
  orderId: string;
  plan: PlanId;
  amountPaise: number;
  credits: number;
  status: (typeof PAYMENT_STATUSES)[number];
  createdAt: string;
  paidAt: string | null;
}

export function toPayment(payment: PaymentDocument): PaymentView {
  return {
    orderId: payment.orderId,
    plan: payment.plan as PlanId,
    amountPaise: payment.amountPaise,
    credits: payment.credits,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  };
}

/** What the API shows of an account. */
export interface AccountView {
  plan: PlanId;
  planExpiresAt: string | null;
  balance: number;
}

export function toAccount(account: AccountDocument): AccountView {
  return {
    plan: account.plan as PlanId,
    planExpiresAt: account.planExpiresAt ? account.planExpiresAt.toISOString() : null,
    balance: account.balance,
  };
}

/** What the API shows of a reservation. */
export interface ReservationView {
  id: string;
  amount: number;
  agent: string;
  status: (typeof RESERVATION_STATUSES)[number];
}

export function toReservation(reservation: ReservationDocument): ReservationView {
  return {
    id: reservation.id,
    amount: reservation.amount,
    agent: reservation.agent,
    status: reservation.status,
  };
}

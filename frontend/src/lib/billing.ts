/** What billing returns for the signed-in user's account (its GET /account). */
export interface Account {
  plan: 'free' | 'starter' | 'pro';
  planExpiresAt: string | null;
  balance: number;
}

export const PLAN_NAMES: Record<Account['plan'], string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
};

/** Below this many credits the card warns that the balance is running low. */
export const LOW_BALANCE = 10;

/** The credits each plan comes with (billing's PLANS); the credits bar measures against them. */
export const PLAN_CREDITS: Record<Account['plan'], number> = {
  free: 100,
  starter: 500,
  pro: 1_000,
};

export interface Plan {
  id: 'starter' | 'pro';
  name: string;
  pricePaise: number;
  credits: number;
  validityDays: number;
}

/** Billing's GET /plans: the plans to buy, the Free plan, and what one answer costs. */
export interface PlansResponse {
  plans: Plan[];
  freePlan: { name: string; credits: number };
  costs: { agent: string; credits: number }[];
  currency: string;
  testMode: boolean;
}

export interface Payment {
  orderId: string;
  plan: Account['plan'];
  amountPaise: number;
  credits: number;
  status: 'created' | 'paid';
  createdAt: string;
  paidAt: string | null;
}

/** Billing's GET /payments: paid payments, newest first, and the sign-up grant once it landed. */
export interface PaymentsResponse {
  items: Payment[];
  signupGrant: { credits: number; grantedAt: string } | null;
}

/** One paid payment as a receipt (billing's GET /payments/:orderId). */
export interface Receipt extends Payment {
  number: string;
  planName: string;
  paymentId: string;
  currency: string;
  /** Paid in Razorpay's test mode: no money was charged. */
  testMode: boolean;
}

export interface UsageSummary {
  days: number;
  totalCredits: number;
  totalAnswers: number;
  /** The median time to an answer's first word in the window; null with no timed answers. */
  medianFirstTokenMs: number | null;
  byAgent: { agent: string; credits: number; answers: number }[];
  byDay: { date: string; credits: number }[];
}

export interface UsageEvent {
  id: string;
  at: string;
  credits: number;
  agent: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  firstTokenMs: number | null;
  chatId: string | null;
  /** running: credits on hold; done: finished; stopped: stopped after it started. */
  status: 'running' | 'done' | 'stopped';
}

/** Each agent as people read it. */
export const AGENT_NAMES: Record<string, string> = {
  chat: 'Chat',
  search: 'Search',
  code: 'Code',
  pdf: 'PDF',
  slides: 'Slides',
  image: 'Image',
  pdf_qa: 'PDF Q&A',
  image_qa: 'Image Q&A',
};

export function agentName(agent: string): string {
  return AGENT_NAMES[agent] ?? agent;
}

/** ₹199 from 19900 paise. */
export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** ₹199.00 from 19900 paise: always two decimals, for payment rows and receipts. */
export function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Nov 4, 2026. */
export const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Nov 4. */
export const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** A time in seconds with one decimal ("0.9 s"); under a tenth of a second, in ms ("40 ms"). */
export function formatDuration(ms: number): string {
  return ms < 100 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Tokens in thousands with one decimal ("1.2k", "0.9k"); under 100 as they are. */
export function formatTokens(count: number): string {
  return count < 100 ? String(count) : `${(count / 1000).toFixed(1)}k`;
}

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Today, 01:12", "Yesterday, 22:15", or "Nov 2, 14:05", on the viewer's clock. */
export function formatWhen(at: Date, now = new Date()): string {
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((day(now).getTime() - day(at).getTime()) / 86_400_000);
  const prefix = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : shortDate.format(at);
  return `${prefix}, ${clock.format(at)}`;
}

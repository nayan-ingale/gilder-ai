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

export interface Payment {
  orderId: string;
  plan: Account['plan'];
  amountPaise: number;
  credits: number;
  status: 'created' | 'paid';
  createdAt: string;
  paidAt: string | null;
}

export interface UsageSummary {
  days: number;
  totalCredits: number;
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
  chatId: string | null;
}

/** ₹199 from 19900 paise. */
export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

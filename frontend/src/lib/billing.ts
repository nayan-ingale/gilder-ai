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

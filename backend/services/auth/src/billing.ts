import type { InternalClient } from '@gilder/shared';

/** Gives a user their sign-up credits; a no-op for a user who already has them. */
export type GrantSignupCredits = (userId: string) => Promise<void>;

/**
 * Asks billing for the sign-up grant. Billing grants once per user, so auth can ask on every
 * sign-in, and a sign-in that failed to get it (billing down) gets it on the next one.
 */
export function billingSignupGrant(billing: InternalClient): GrantSignupCredits {
  return async (userId) => {
    await billing.request('POST', '/internal/accounts', { userId, retry: true });
  };
}

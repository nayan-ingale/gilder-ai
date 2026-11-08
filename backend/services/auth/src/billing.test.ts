import type { InternalClient } from '@gilder/shared';
import { describe, expect, it, vi } from 'vitest';
import { billingSignupGrant } from './billing.ts';

describe('billingSignupGrant', () => {
  it("posts to billing's grant route for the user, with one retry allowed", async () => {
    const request = vi.fn(async () => ({ granted: true }));
    const billing = { request } as unknown as InternalClient;

    await billingSignupGrant(billing)('u1');

    expect(request).toHaveBeenCalledWith('POST', '/internal/accounts', {
      userId: 'u1',
      retry: true,
    });
  });
});

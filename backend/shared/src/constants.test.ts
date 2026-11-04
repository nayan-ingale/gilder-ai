import { describe, expect, it } from 'vitest';
import { AGENT_RATE_LIMITS, AGENTS, CREDIT_COSTS, PLANS, SIGNUP_CREDITS } from './constants.ts';

describe('constants', () => {
  it('gives every agent a positive whole-number cost and rate limit', () => {
    for (const agent of AGENTS) {
      expect(Number.isInteger(CREDIT_COSTS[agent]) && CREDIT_COSTS[agent] > 0).toBe(true);
      expect(Number.isInteger(AGENT_RATE_LIMITS[agent]) && AGENT_RATE_LIMITS[agent] > 0).toBe(true);
    }
  });

  it('prices plans in whole paise and grants the sign-up credits on Free', () => {
    for (const plan of Object.values(PLANS)) {
      expect(Number.isInteger(plan.pricePaise)).toBe(true);
    }
    expect(PLANS.free.credits).toBe(SIGNUP_CREDITS);
    expect(PLANS.starter.pricePaise).toBe(19_900);
  });
});

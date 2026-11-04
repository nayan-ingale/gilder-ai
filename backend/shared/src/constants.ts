/** Every agent a chat turn can run. */
export const AGENTS = [
  'chat',
  'search',
  'code',
  'pdf',
  'slides',
  'image',
  'pdf_qa',
  'image_qa',
] as const;

export type Agent = (typeof AGENTS)[number];

/** Credits charged per answer. Choosing the agent (the router call) is free. */
export const CREDIT_COSTS: Readonly<Record<Agent, number>> = {
  chat: 1,
  search: 5,
  code: 10,
  pdf: 10,
  slides: 10,
  image: 10,
  pdf_qa: 10,
  image_qa: 10,
};

/** Requests per minute, per user, for each agent. */
export const AGENT_RATE_LIMITS: Readonly<Record<Agent, number>> = {
  chat: 20,
  search: 5,
  code: 5,
  pdf: 5,
  slides: 5,
  image: 5,
  pdf_qa: 5,
  image_qa: 5,
};

/** Credits every new account starts with. */
export const SIGNUP_CREDITS = 100;

export interface Plan {
  id: string;
  name: string;
  /** Price in paise (₹1 = 100 paise), the unit Razorpay works in. Integers avoid rounding errors. */
  pricePaise: number;
  credits: number;
  /** How long the plan badge lasts. Purchased credits never expire. */
  validityDays: number;
}

export const PLANS = {
  free: { id: 'free', name: 'Free', pricePaise: 0, credits: SIGNUP_CREDITS, validityDays: 30 },
  starter: { id: 'starter', name: 'Starter', pricePaise: 19_900, credits: 500, validityDays: 30 },
  pro: { id: 'pro', name: 'Pro', pricePaise: 49_900, credits: 1_000, validityDays: 30 },
} as const satisfies Record<string, Plan>;

export type PlanId = keyof typeof PLANS;

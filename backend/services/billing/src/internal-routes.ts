import { AGENTS, requireCaller, requireUser, validate, z } from '@gilder/shared';
import { type Response, Router } from 'express';
import {
  commitCredits,
  type CreditChange,
  grantSignupCredits,
  releaseCredits,
  reserveCredits,
} from './credits.ts';
import { toAccount, toReservation } from './models.ts';

/**
 * Routes other services call; the gateway never forwards /internal routes. Each one names the
 * service allowed to use it, and acts for the user in the token.
 */

const reserveBody = z
  .object({
    agent: z.enum(AGENTS),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();

const count = z.number().int().min(0).max(10_000_000);
const commitBody = z
  .object({
    reservationId: z.string().min(1).max(64),
    metadata: z
      .object({
        model: z.string().max(200).optional(),
        inputTokens: count.optional(),
        outputTokens: count.optional(),
        latencyMs: count.optional(),
        firstTokenMs: count.optional(),
        chatId: z.string().max(64).optional(),
        messageId: z.string().max(64).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

const releaseBody = z.object({ reservationId: z.string().min(1).max(64) }).strict();

function sendChange(res: Response, change: CreditChange, status = 200) {
  res
    .status(status)
    .json({ reservation: toReservation(change.reservation), balance: change.balance });
}

export function internalRouter(): Router {
  const router = Router();
  router.use('/internal', requireUser());

  // Auth calls this on every sign-in; only the first one for a user grants anything.
  router.post('/internal/accounts', requireCaller('auth'), async (_req, res) => {
    const { account, granted } = await grantSignupCredits(res.locals.userId as string);
    res.status(granted ? 201 : 200).json({ account: toAccount(account), granted });
  });

  // The agent holds an answer's credits before calling any AI provider: 402 when too few.
  router.post(
    '/internal/credits/reserve',
    requireCaller('agent'),
    validate({ body: reserveBody }),
    async (req, res) => {
      const { agent, idempotencyKey } = req.body as z.output<typeof reserveBody>;
      const change = await reserveCredits({
        userId: res.locals.userId as string,
        agent,
        idempotencyKey,
      });
      sendChange(res, change, change.created ? 201 : 200);
    },
  );

  router.post(
    '/internal/credits/commit',
    requireCaller('agent'),
    validate({ body: commitBody }),
    async (req, res) => {
      const { reservationId, metadata } = req.body as z.output<typeof commitBody>;
      sendChange(res, await commitCredits(res.locals.userId as string, reservationId, metadata));
    },
  );

  router.post(
    '/internal/credits/release',
    requireCaller('agent'),
    validate({ body: releaseBody }),
    async (req, res) => {
      const { reservationId } = req.body as z.output<typeof releaseBody>;
      sendChange(res, await releaseCredits(res.locals.userId as string, reservationId));
    },
  );

  return router;
}

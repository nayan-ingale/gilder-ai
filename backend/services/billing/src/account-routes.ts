import { requireUser } from '@gilder/shared';
import { Router } from 'express';
import { AccountModel, toAccount } from './models.ts';

/** The signed-in user's plan and balance, for the credits card. Reached through the gateway. */
export function accountRouter(): Router {
  const router = Router();

  router.get('/account', requireUser(), async (_req, res) => {
    const account = await AccountModel.findById(res.locals.userId as string);
    // No account yet means the sign-up grant hasn't landed (billing was down at sign-in); the
    // next sign-in creates it. Until then the user simply has no credits.
    res.json({
      account: account ? toAccount(account) : { plan: 'free', planExpiresAt: null, balance: 0 },
    });
  });

  return router;
}

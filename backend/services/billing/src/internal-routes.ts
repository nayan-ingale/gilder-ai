import { requireCaller, requireUser } from '@gilder/shared';
import { Router } from 'express';
import { grantSignupCredits } from './credits.ts';
import { toAccount } from './models.ts';

/**
 * Routes other services call; the gateway never forwards /internal routes. Each one names the
 * service allowed to use it, and acts for the user in the token.
 */
export function internalRouter(): Router {
  const router = Router();
  router.use('/internal', requireUser());

  // Auth calls this on every sign-in; only the first one for a user grants anything.
  router.post('/internal/accounts', requireCaller('auth'), async (_req, res) => {
    const { account, granted } = await grantSignupCredits(res.locals.userId as string);
    res.status(granted ? 201 : 200).json({ account: toAccount(account), granted });
  });

  return router;
}

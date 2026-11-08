import { AppError, requireUser, validate, z } from '@gilder/shared';
import { type Response, Router } from 'express';
import { THEME_PREFERENCES, toProfile, type UserDocument, UserModel } from './users.ts';

/**
 * The signed-in user's own profile, and the user lookup other services use. Every route acts
 * for the user named in the internal token, so a user only ever sees their own account.
 */

const updateMeBody = z.object({ themePreference: z.enum(THEME_PREFERENCES) }).strict();
const userIdParams = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'is not a user ID') });

/** The user the internal token names. A session for a user that no longer exists is a 401. */
async function currentUser(res: Response): Promise<UserDocument> {
  const user = await UserModel.findById(res.locals.userId);
  if (!user) {
    throw new AppError('unauthorized', 'This account no longer exists');
  }
  return user;
}

export function meRouter(): Router {
  const router = Router();

  router.get('/me', requireUser(), async (_req, res) => {
    res.json({ user: toProfile(await currentUser(res)) });
  });

  // Today only the theme can change. `strict()` rejects any other field instead of ignoring it.
  router.patch('/me', requireUser(), validate({ body: updateMeBody }), async (req, res) => {
    const { themePreference } = req.body as z.output<typeof updateMeBody>;
    const user = await currentUser(res);
    user.themePreference = themePreference;
    await user.save();
    res.json({ user: toProfile(user) });
  });

  // For other services, with a token for the same user. Asking for anyone else gets the same 404
  // as an unknown ID, so the route can't be used to find out which accounts exist.
  router.get(
    '/internal/users/:id',
    requireUser(),
    validate({ params: userIdParams }),
    async (req, res) => {
      const { id } = req.params as z.output<typeof userIdParams>;
      const user = id === res.locals.userId ? await UserModel.findById(id) : null;
      if (!user) {
        throw new AppError('not_found', 'No such user');
      }
      res.json({ user: toProfile(user) });
    },
  );

  return router;
}

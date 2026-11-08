import { mongoose, SIGNUP_CREDITS } from '@gilder/shared';
import { type AccountDocument, AccountModel, LedgerModel } from './models.ts';

/**
 * Every change to a balance, each in one MongoDB transaction with its ledger entry, so the
 * balance and the ledger can never disagree.
 */

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

/** Runs `work` in a transaction, retried by the driver on transient conflicts. */
export async function inTransaction<T>(
  work: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}

export interface GrantResult {
  account: AccountDocument;
  /** False when the user already had their grant: the call changed nothing. */
  granted: boolean;
}

/**
 * Gives a new user their sign-up credits, once. Safe to call on every sign-in: a user who already
 * has the grant gets their account back unchanged, even when two sign-ins race (the ledger allows
 * one sign-up grant per user).
 */
export async function grantSignupCredits(userId: string): Promise<GrantResult> {
  const alreadyGranted = await LedgerModel.exists({ userId, kind: 'signup_grant' });
  if (!alreadyGranted) {
    try {
      await inTransaction(async (session) => {
        await LedgerModel.create([{ userId, delta: SIGNUP_CREDITS, kind: 'signup_grant' }], {
          session,
        });
        await AccountModel.updateOne(
          { _id: userId },
          { $inc: { balance: SIGNUP_CREDITS }, $setOnInsert: { plan: 'free' } },
          { upsert: true, session },
        );
      });
      return { account: await findAccount(userId), granted: true };
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
      // Another sign-in granted the credits first; fall through to return the account.
    }
  }
  return { account: await findAccount(userId), granted: false };
}

async function findAccount(userId: string): Promise<AccountDocument> {
  const account = await AccountModel.findById(userId);
  if (!account) {
    throw new Error(`the account for ${userId} is missing after its grant`);
  }
  return account;
}

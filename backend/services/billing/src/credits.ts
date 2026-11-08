import { type Agent, AppError, CREDIT_COSTS, mongoose, SIGNUP_CREDITS } from '@gilder/shared';
import {
  type AccountDocument,
  AccountModel,
  LedgerModel,
  type ReservationDocument,
  ReservationModel,
} from './models.ts';

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

export interface CreditChange {
  reservation: ReservationDocument;
  /** The account's balance after the change. */
  balance: number;
}

export interface ReserveInput {
  userId: string;
  agent: Agent;
  /** Chosen by the caller for one answer; a retried reserve returns the first hold. */
  idempotencyKey: string;
}

/**
 * Holds an answer's credits before the AI runs. The balance check and the decrease are one
 * conditional update, so parallel requests can never overdraw: when the balance is too low no
 * document matches, and the answer is refused with 402 before any provider is called.
 */
export async function reserveCredits(
  input: ReserveInput,
): Promise<CreditChange & { created: boolean }> {
  const { userId, agent, idempotencyKey } = input;
  const existing = await findByKey(userId, idempotencyKey);
  if (existing) {
    return { ...existing, created: false };
  }

  const amount = CREDIT_COSTS[agent];
  try {
    const change = await inTransaction(async (session) => {
      const account = await AccountModel.findOneAndUpdate(
        { _id: userId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { returnDocument: 'after', session },
      );
      if (!account) {
        const current = await AccountModel.findById(userId).session(session);
        throw new AppError(
          'insufficient_credits',
          `This answer needs ${amount} ${amount === 1 ? 'credit' : 'credits'}; you have ${current?.balance ?? 0}`,
        );
      }
      const [reservation] = await ReservationModel.create(
        [{ userId, amount, agent, idempotencyKey }],
        { session },
      );
      if (!reservation) {
        throw new Error('the reservation was not created');
      }
      return { reservation, balance: account.balance };
    });
    return { ...change, created: true };
  } catch (error) {
    // The same reserve, retried in parallel: the unique key kept the first hold.
    const winner = isDuplicateKey(error) ? await findByKey(userId, idempotencyKey) : undefined;
    if (!winner) {
      throw error;
    }
    return { ...winner, created: false };
  }
}

async function findByKey(
  userId: string,
  idempotencyKey: string,
): Promise<CreditChange | undefined> {
  const reservation = await ReservationModel.findOne({ idempotencyKey });
  if (!reservation) {
    return undefined;
  }
  if (reservation.userId !== userId) {
    throw new AppError('conflict', 'This idempotency key was used for another request');
  }
  return { reservation, balance: await balanceOf(userId) };
}

/** What the answer used, kept on its usage ledger entry. */
export interface UsageMetadata {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  chatId?: string;
  messageId?: string;
}

/**
 * Charges a held reservation once the answer is done (or was stopped after it started): marks it
 * committed and appends the usage entry. Committing twice changes nothing.
 */
export async function commitCredits(
  userId: string,
  reservationId: string,
  metadata: UsageMetadata = {},
): Promise<CreditChange> {
  assertReservationId(reservationId);
  return inTransaction(async (session) => {
    const reservation = await ReservationModel.findOneAndUpdate(
      { _id: reservationId, userId, status: 'held' },
      { status: 'committed' },
      { returnDocument: 'after', session },
    );
    if (!reservation) {
      return settledAlready(userId, reservationId, 'committed', session);
    }
    await LedgerModel.create(
      [
        {
          userId,
          delta: -reservation.amount,
          kind: 'usage',
          reservationId: reservation._id,
          metadata: { agent: reservation.agent, ...metadata },
        },
      ],
      { session },
    );
    return { reservation, balance: await balanceOf(userId, session) };
  });
}

/**
 * Gives a held reservation's credits back: after an error, or a stop before the first token.
 * Releasing twice changes nothing.
 */
export async function releaseCredits(userId: string, reservationId: string): Promise<CreditChange> {
  assertReservationId(reservationId);
  return inTransaction(async (session) => {
    const reservation = await releaseHeld({ _id: reservationId, userId }, session);
    if (!reservation) {
      return settledAlready(userId, reservationId, 'released', session);
    }
    return { reservation, balance: await balanceOf(userId, session) };
  });
}

/** Marks one held reservation matching `filter` released and returns its credits. */
export async function releaseHeld(
  filter: Record<string, unknown>,
  session: mongoose.ClientSession,
): Promise<ReservationDocument | null> {
  const reservation = await ReservationModel.findOneAndUpdate(
    { ...filter, status: 'held' },
    { status: 'released' },
    { returnDocument: 'after', session },
  );
  if (reservation) {
    await AccountModel.updateOne(
      { _id: reservation.userId },
      { $inc: { balance: reservation.amount } },
      { session },
    );
  }
  return reservation;
}

/**
 * A reservation that is no longer held: the same outcome again is a no-op, the opposite one is a
 * conflict, and a reservation that isn't the user's doesn't exist for them.
 */
async function settledAlready(
  userId: string,
  reservationId: string,
  wanted: 'committed' | 'released',
  session: mongoose.ClientSession,
): Promise<CreditChange> {
  const reservation = await ReservationModel.findOne({ _id: reservationId, userId }).session(
    session,
  );
  if (!reservation) {
    throw new AppError('not_found', 'No such reservation');
  }
  if (reservation.status !== wanted) {
    throw new AppError('conflict', `This reservation was already ${reservation.status}`);
  }
  return { reservation, balance: await balanceOf(userId, session) };
}

/** An ID that can't be a reservation is "not found", never a database cast error (500). */
function assertReservationId(reservationId: string): void {
  if (!mongoose.isValidObjectId(reservationId)) {
    throw new AppError('not_found', 'No such reservation');
  }
}

async function balanceOf(userId: string, session?: mongoose.ClientSession): Promise<number> {
  const account = await AccountModel.findById(userId).session(session ?? null);
  return account?.balance ?? 0;
}

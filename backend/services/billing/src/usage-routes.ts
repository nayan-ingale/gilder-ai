import { requireUser, validate, z } from '@gilder/shared';
import { Router } from 'express';
import { LedgerModel, ReservationModel } from './models.ts';

/**
 * The usage page's data, from the ledger's usage entries: credits by agent and by day, the
 * median time to the first word, and the latest answers with their model, tokens and time taken.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * True for any time zone name the runtime knows, aliases included. (The list from
 * Intl.supportedValuesOf leaves out aliases such as Asia/Kolkata, so it can't be used here.)
 */
function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
const summaryQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  /** Days are counted in the viewer's time zone, so "today" matches their clock. */
  tz: z.string().max(64).refine(isTimeZone, 'is not a known time zone').default('UTC'),
});
const eventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.iso.datetime().optional(),
});

interface UsageMetadata {
  agent?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  firstTokenMs?: number;
  chatId?: string;
}

export function usageRouter(): Router {
  const router = Router();

  router.get(
    '/usage/summary',
    requireUser(),
    validate({ query: summaryQuery }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const { days, tz } = req.query as unknown as z.output<typeof summaryQuery>;
      const since = new Date(Date.now() - days * DAY_MS);
      const match = { userId, kind: 'usage', createdAt: { $gte: since } };

      const [byAgent, byDay, firstToken] = await Promise.all([
        LedgerModel.aggregate<{ _id: string | null; credits: number; answers: number }>([
          { $match: match },
          {
            $group: {
              _id: '$metadata.agent',
              credits: { $sum: { $multiply: ['$delta', -1] } },
              answers: { $sum: 1 },
            },
          },
          { $sort: { credits: -1 } },
        ]),
        LedgerModel.aggregate<{ _id: string; credits: number }>([
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
              credits: { $sum: { $multiply: ['$delta', -1] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        // Only answers that timed their first word: a stopped answer has no timing.
        LedgerModel.aggregate<{ median: number | null }>([
          { $match: { ...match, 'metadata.firstTokenMs': { $type: 'number' } } },
          {
            $group: {
              _id: null,
              median: { $median: { input: '$metadata.firstTokenMs', method: 'approximate' } },
            },
          },
        ]),
      ]);
      const median = firstToken[0]?.median;

      res.json({
        days,
        totalCredits: byAgent.reduce((sum, row) => sum + row.credits, 0),
        totalAnswers: byAgent.reduce((sum, row) => sum + row.answers, 0),
        medianFirstTokenMs: typeof median === 'number' ? Math.round(median) : null,
        byAgent: byAgent.map((row) => ({
          agent: row._id ?? 'chat',
          credits: row.credits,
          answers: row.answers,
        })),
        byDay: byDay.map((row) => ({ date: row._id, credits: row.credits })),
      });
    },
  );

  // The first page starts with the answers still running (credits on hold); then the charged
  // ones. A finished answer always records its time; one stopped part-way does not.
  router.get('/usage/events', requireUser(), validate({ query: eventsQuery }), async (req, res) => {
    const userId = res.locals.userId as string;
    const { limit, before } = req.query as unknown as z.output<typeof eventsQuery>;
    const [held, entries] = await Promise.all([
      before
        ? []
        : ReservationModel.find({ userId, status: 'held' }).sort({ createdAt: -1 }).limit(limit),
      LedgerModel.find({
        userId,
        kind: 'usage',
        ...(before ? { createdAt: { $lt: new Date(before) } } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(limit),
    ]);
    const running = held.map((hold) => ({
      id: hold.id,
      at: hold.createdAt.toISOString(),
      credits: hold.amount,
      agent: hold.agent,
      model: null,
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      firstTokenMs: null,
      chatId: null,
      status: 'running' as const,
    }));
    const charged = entries.map((entry) => {
      const metadata = (entry.metadata ?? {}) as UsageMetadata;
      return {
        id: entry.id,
        at: entry.createdAt.toISOString(),
        credits: -entry.delta,
        agent: metadata.agent ?? 'chat',
        model: metadata.model ?? null,
        inputTokens: metadata.inputTokens ?? null,
        outputTokens: metadata.outputTokens ?? null,
        latencyMs: metadata.latencyMs ?? null,
        firstTokenMs: metadata.firstTokenMs ?? null,
        chatId: metadata.chatId ?? null,
        status: metadata.latencyMs === undefined ? ('stopped' as const) : ('done' as const),
      };
    });
    res.json({ items: [...running, ...charged].slice(0, limit) });
  });

  return router;
}

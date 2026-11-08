import { requireUser, validate, z } from '@gilder/shared';
import { Router } from 'express';
import { LedgerModel } from './models.ts';

/**
 * The usage page's data, from the ledger's usage entries: credits by agent and by day, and the
 * latest answers with their model, tokens and time taken.
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

      const [byAgent, byDay] = await Promise.all([
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
      ]);

      res.json({
        days,
        totalCredits: byAgent.reduce((sum, row) => sum + row.credits, 0),
        byAgent: byAgent.map((row) => ({
          agent: row._id ?? 'chat',
          credits: row.credits,
          answers: row.answers,
        })),
        byDay: byDay.map((row) => ({ date: row._id, credits: row.credits })),
      });
    },
  );

  router.get('/usage/events', requireUser(), validate({ query: eventsQuery }), async (req, res) => {
    const userId = res.locals.userId as string;
    const { limit, before } = req.query as unknown as z.output<typeof eventsQuery>;
    const entries = await LedgerModel.find({
      userId,
      kind: 'usage',
      ...(before ? { createdAt: { $lt: new Date(before) } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({
      items: entries.map((entry) => {
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
          chatId: metadata.chatId ?? null,
        };
      }),
    });
  });

  return router;
}

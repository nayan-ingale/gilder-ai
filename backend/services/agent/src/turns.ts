import {
  type Agent,
  AGENTS,
  AppError,
  CREDIT_COSTS,
  getContext,
  type Logger,
  type Redis,
  requireUser,
  validate,
  z,
} from '@gilder/shared';
import { type Response, Router } from 'express';
import type { AgentRunner } from './agents/types.ts';
import { type EventStream, openEventStream } from './event-stream.ts';
import type { Llm } from './llm/llm.ts';
import type { Memory, MemoryMessage } from './memory.ts';
import { parseShortcut, type Route, routeMessage } from './routing.ts';
import type { BillingService, ChatService, Reservation } from './services.ts';
import { generateTitle } from './title.ts';

/**
 * One answer, start to finish. Everything that can refuse the request (the chat isn't yours, no
 * credits, a duplicate send) happens before the stream starts, so it gets an ordinary error
 * reply. Then the reply becomes a stream of events, and the credits are settled whatever
 * happens: committed for a finished answer, released for a failed one.
 */

const DEFAULT_TITLE = 'New chat';
const LOCK_SECONDS = 15 * 60;

const turnParams = z.object({ chatId: z.string().min(1).max(64) });
const turnBody = z
  .object({
    content: z.string().trim().min(1).max(20_000),
    /** Chosen by the browser per message, so a retried send is answered once. */
    clientMessageId: z
      .string()
      .min(8)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/),
    /** The agent chip the user picked, if any. */
    agent: z.enum(AGENTS).optional(),
  })
  .strict();

export interface TurnDeps {
  llm: Llm;
  chat: ChatService;
  billing: BillingService;
  memory: Memory;
  redis: Redis;
  logger: Logger;
  agents: Partial<Record<Agent, AgentRunner>>;
  available: ReadonlySet<Agent>;
  heartbeatMs?: number;
}

export function turnRouter(deps: TurnDeps): Router {
  const router = Router();

  router.post(
    '/chats/:chatId/turns',
    requireUser(),
    validate({ params: turnParams, body: turnBody }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const { chatId } = req.params as z.output<typeof turnParams>;
      const { content, clientMessageId, agent: chosen } = req.body as z.output<typeof turnBody>;
      const parsed = parseShortcut(content);
      if (parsed.text.trim() === '') {
        throw new AppError('bad_request', 'Write a message after the shortcut');
      }

      const chat = await deps.chat.getChat(userId, chatId);

      // One answer per message at a time: a second copy of the same send is refused.
      const lockKey = `turn-lock:${chatId}:${clientMessageId}`;
      if (!(await deps.redis.set(lockKey, '1', 'EX', LOCK_SECONDS, 'NX'))) {
        throw new AppError('conflict', 'This message is already being answered');
      }
      try {
        // No credits at all: refuse before any AI call, the router's included.
        if ((await deps.billing.balance(userId)) < CREDIT_COSTS.chat) {
          throw new AppError('insufficient_credits', 'You are out of credits');
        }
        const memory = await deps.memory.load(chatId, userId);
        const route = await routeMessage(
          { text: parsed.text, chosen: chosen ?? parsed.shortcut, available: deps.available },
          deps.llm,
          deps.logger,
        );
        const { reservation } = await deps.billing.reserve(
          userId,
          route.agent,
          `turn:${chatId}:${clientMessageId}`,
        );
        if (reservation.status !== 'held') {
          throw new AppError('conflict', 'This message was already answered');
        }

        let messageIds: { user: string; answer: string };
        try {
          const { message: userMessage } = await deps.chat.saveMessage(userId, {
            chatId,
            role: 'user',
            content,
            clientMessageId,
            ...(chosen ? { agent: chosen } : {}),
          });
          const { message: answer } = await deps.chat.saveMessage(userId, {
            chatId,
            role: 'assistant',
            agent: route.agent,
            status: 'streaming',
          });
          messageIds = { user: userMessage.id, answer: answer.id };
        } catch (error) {
          await deps.billing.release(userId, reservation.id).catch(() => undefined);
          throw error;
        }

        await streamAnswer(deps, res, {
          userId,
          chatId,
          content,
          text: parsed.text,
          memory,
          route,
          reservation,
          messageIds,
          needsTitle: chat.title === DEFAULT_TITLE,
        });
      } finally {
        await deps.redis.del(lockKey);
      }
    },
  );

  return router;
}

interface Turn {
  userId: string;
  chatId: string;
  /** The message as the user wrote it, shortcut included. */
  content: string;
  /** The message the agent answers, without the shortcut. */
  text: string;
  memory: MemoryMessage[];
  route: Route;
  reservation: Reservation;
  messageIds: { user: string; answer: string };
  needsTitle: boolean;
}

async function streamAnswer(deps: TurnDeps, res: Response, turn: Turn): Promise<void> {
  const { userId, chatId, reservation } = turn;
  const runner = deps.agents[turn.route.agent] ?? deps.agents.chat;
  if (!runner) {
    throw new Error('no chat agent is registered');
  }

  const stream = openEventStream(res, deps.heartbeatMs);
  const controller = new AbortController();
  // The browser going away (a closed tab, a stop) ends the answer like a stop.
  res.on('close', () => {
    if (!res.writableFinished) {
      controller.abort();
    }
  });

  stream.send('meta', {
    turnId: turn.messageIds.answer,
    userMessageId: turn.messageIds.user,
    assistantMessageId: turn.messageIds.answer,
  });
  stream.send('agent', { agent: turn.route.agent, reason: turn.route.reason });

  // A new chat gets its title while the answer streams.
  const title = turn.needsTitle ? titleChat(deps, turn, controller.signal) : Promise.resolve(null);

  const started = Date.now();
  let text = '';
  let firstTokenAt: number | undefined;
  let model: string | undefined;
  let usage = { inputTokens: 0, outputTokens: 0 };

  try {
    for await (const event of runner.run({
      text: turn.text,
      memory: turn.memory,
      llm: deps.llm,
      signal: controller.signal,
    })) {
      if (event.type === 'model') {
        model = event.model;
      } else if (event.type === 'token') {
        firstTokenAt ??= Date.now();
        text += event.text;
        stream.send('token', { text: event.text });
      } else {
        usage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
      }
    }

    await deps.chat.updateMessage(userId, turn.messageIds.answer, {
      content: text,
      status: 'complete',
    });
    const committed = await deps.billing.commit(userId, reservation.id, {
      ...(model ? { model } : {}),
      ...usage,
      latencyMs: Date.now() - started,
      chatId,
      messageId: turn.messageIds.answer,
    });
    stream.send('usage', { creditsCharged: reservation.amount, balance: committed.balance });
    await deps.memory.append(chatId, [
      { role: 'user', content: turn.content },
      { role: 'assistant', content: text },
    ]);
    const newTitle = await title;
    if (newTitle) {
      stream.send('title', { title: newTitle });
    }
    stream.send('done', {});
  } catch (error) {
    await settleUnfinished(deps, stream, turn, {
      error,
      stopped: controller.signal.aborted,
      text,
      started: firstTokenAt !== undefined,
    });
  } finally {
    stream.close();
  }
}

/**
 * An answer that didn't finish. A stop after text started is charged (the user got part of an
 * answer); a stop before it, or any failure, gives the credits back. The partial text is kept.
 */
async function settleUnfinished(
  deps: TurnDeps,
  stream: EventStream,
  turn: Turn,
  outcome: { error: unknown; stopped: boolean; text: string; started: boolean },
): Promise<void> {
  const { userId, reservation } = turn;
  const charge = outcome.stopped && outcome.started;
  try {
    await deps.chat.updateMessage(userId, turn.messageIds.answer, {
      content: outcome.text,
      status: outcome.stopped ? 'stopped' : 'failed',
    });
    if (charge) {
      const committed = await deps.billing.commit(userId, reservation.id, {
        chatId: turn.chatId,
        messageId: turn.messageIds.answer,
      });
      stream.send('usage', { creditsCharged: reservation.amount, balance: committed.balance });
    } else {
      await deps.billing.release(userId, reservation.id);
    }
    // Earlier history is unchanged, but the cache doesn't hold this turn: let it reload.
    await deps.memory.forget(turn.chatId);
  } catch (settleError) {
    // The sweeper releases a hold left behind; the user still gets a clear end to the stream.
    deps.logger.error({ err: settleError }, 'could not settle an unfinished answer');
  }

  if (!outcome.stopped) {
    deps.logger.error({ err: outcome.error, agent: turn.route.agent }, 'the answer failed');
    const known = outcome.error instanceof AppError ? outcome.error : undefined;
    stream.send('error', {
      code: known ? known.code : 'answer_failed',
      message: known ? known.message : 'The answer failed. Your credits were not charged.',
      requestId: getContext()?.requestId,
    });
  }
  stream.send('done', {});
}

async function titleChat(deps: TurnDeps, turn: Turn, signal: AbortSignal): Promise<string | null> {
  try {
    const title = await generateTitle(deps.llm, turn.text, signal);
    if (title) {
      await deps.chat.autoTitle(turn.userId, turn.chatId, title);
    }
    return title;
  } catch (error) {
    if (!signal.aborted) {
      deps.logger.warn({ err: error }, 'could not title the chat');
    }
    return null;
  }
}

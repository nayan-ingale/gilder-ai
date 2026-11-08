import {
  type Agent,
  AGENT_RATE_LIMITS,
  AGENTS,
  AppError,
  CREDIT_COSTS,
  getContext,
  hitRateLimit,
  type Logger,
  mongoose,
  type Redis,
  requireUser,
  validate,
  z,
} from '@gilder/shared';
import { type Response, Router } from 'express';
import type { AgentRunner, Attachment } from './agents/types.ts';
import { DocumentModel, FileModel } from './files/models.ts';
import { type EventStream, openEventStream } from './event-stream.ts';
import type { Llm } from './llm/llm.ts';
import { type Memory, type MemoryMessage, trimToBudget } from './memory.ts';
import { parseShortcut, type Route, routeMessage } from './routing.ts';
import type { BillingService, ChatInfo, ChatService, Reservation } from './services.ts';
import type { StopSignals } from './stops.ts';
import { generateTitle } from './title.ts';

/**
 * One answer, start to finish. Everything that can refuse the request (the chat isn't yours, no
 * credits, a duplicate send) happens before the stream starts, so it gets an ordinary error
 * reply. Then the reply becomes a stream of events, and the credits are settled whatever
 * happens: committed for a finished answer, released for a failed one.
 */

const DEFAULT_TITLE = 'New chat';
const LOCK_SECONDS = 15 * 60;

const id = z.string().min(1).max(64);
const turnParams = z.object({ chatId: id });
const messageParams = z.object({ chatId: id, messageId: id });
const turnIdParams = z.object({ turnId: id });
/** Chosen by the browser per action, so a retried request is answered once. */
const clientMessageId = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const content = z.string().trim().min(1).max(20_000);
const turnBody = z
  .object({
    content,
    clientMessageId,
    /** The agent chip the user picked, if any. */
    agent: z.enum(AGENTS).optional(),
    /** Files uploaded to this chat to send with the message: PDFs or images. */
    attachments: z.array(id).max(4).optional(),
  })
  .strict();
const regenerateBody = z.object({ clientMessageId }).strict();

export interface TurnDeps {
  llm: Llm;
  chat: ChatService;
  billing: BillingService;
  memory: Memory;
  redis: Redis;
  logger: Logger;
  agents: Partial<Record<Agent, AgentRunner>>;
  available: ReadonlySet<Agent>;
  stops: StopSignals;
  heartbeatMs?: number;
}

export function turnRouter(deps: TurnDeps): Router {
  const router = Router();

  // A new message.
  router.post(
    '/chats/:chatId/turns',
    requireUser(),
    validate({ params: turnParams, body: turnBody }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const { chatId } = req.params as z.output<typeof turnParams>;
      const body = req.body as z.output<typeof turnBody>;
      const parsed = parseShortcut(body.content);
      requireText(parsed.text);
      const chat = await deps.chat.getChat(userId, chatId);

      await runTurn(deps, res, {
        userId,
        chat,
        clientMessageId: body.clientMessageId,
        content: body.content,
        text: parsed.text,
        chooseAgent: { chosen: body.agent ?? parsed.shortcut },
        loadMemory: () => deps.memory.load(chatId, userId),
        reserveKey: `turn:${chatId}:${body.clientMessageId}`,
        userMessage: { save: true, ...(body.agent ? { agent: body.agent } : {}), supersedes: [] },
        attachmentIds: body.attachments ?? [],
        answerSupersedes: [],
        historyChanged: false,
      });
    },
  );

  // A new answer to the latest message, with the same agent. The old answer is hidden.
  router.post(
    '/chats/:chatId/messages/:messageId/regenerate',
    requireUser(),
    validate({ params: messageParams, body: regenerateBody }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const { chatId, messageId } = req.params as z.output<typeof messageParams>;
      const { clientMessageId: actionId } = req.body as z.output<typeof regenerateBody>;
      const chat = await deps.chat.getChat(userId, chatId);
      const last = await deps.chat.lastTurn(userId, chatId);
      if (!last.user || !last.answer || last.answer.id !== messageId) {
        throw new AppError('conflict', 'Only the latest answer can be regenerated');
      }
      if (last.answer.status === 'streaming') {
        throw new AppError('conflict', 'This answer is still being written');
      }
      const { user, answer } = last;

      await runTurn(deps, res, {
        userId,
        chat,
        clientMessageId: actionId,
        content: user.content,
        text: parseShortcut(user.content).text,
        chooseAgent: { fixed: answer.agent ?? 'chat' },
        loadMemory: () => historyWithout(deps, userId, chatId, [user.id, answer.id]),
        reserveKey: `regenerate:${answer.id}:${actionId}`,
        userMessage: { save: false, id: user.id },
        attachmentIds: user.attachments,
        answerSupersedes: [answer.id],
        historyChanged: true,
      });
    },
  );

  // The latest message, rewritten and answered again. The old message and its answer are hidden.
  router.post(
    '/chats/:chatId/messages/:messageId/edit',
    requireUser(),
    validate({ params: messageParams, body: turnBody }),
    async (req, res) => {
      const userId = res.locals.userId as string;
      const { chatId, messageId } = req.params as z.output<typeof messageParams>;
      const body = req.body as z.output<typeof turnBody>;
      const parsed = parseShortcut(body.content);
      requireText(parsed.text);
      const chat = await deps.chat.getChat(userId, chatId);
      const last = await deps.chat.lastTurn(userId, chatId);
      if (!last.user || last.user.id !== messageId) {
        throw new AppError('conflict', 'Only your latest message can be edited');
      }
      if (last.answer?.status === 'streaming') {
        throw new AppError('conflict', 'This answer is still being written');
      }
      const replaced = [last.user.id, ...(last.answer ? [last.answer.id] : [])];

      await runTurn(deps, res, {
        userId,
        chat,
        clientMessageId: body.clientMessageId,
        content: body.content,
        text: parsed.text,
        chooseAgent: { chosen: body.agent ?? parsed.shortcut },
        loadMemory: () => historyWithout(deps, userId, chatId, replaced),
        reserveKey: `turn:${chatId}:${body.clientMessageId}`,
        userMessage: {
          save: true,
          ...(body.agent ? { agent: body.agent } : {}),
          supersedes: replaced,
        },
        attachmentIds: body.attachments ?? [],
        answerSupersedes: [],
        historyChanged: true,
      });
    },
  );

  // Stop an answer that is being written, from any agent instance.
  router.post(
    '/turns/:turnId/stop',
    requireUser(),
    validate({ params: turnIdParams }),
    async (req, res) => {
      const { turnId } = req.params as z.output<typeof turnIdParams>;
      if (!(await deps.stops.stop(turnId, res.locals.userId as string))) {
        throw new AppError('not_found', 'No answer is being written for this turn');
      }
      res.status(202).json({ stopping: true });
    },
  );

  return router;
}

function requireText(text: string): void {
  if (text.trim() === '') {
    throw new AppError('bad_request', 'Write a message after the shortcut');
  }
}

/** The chat's finished messages, fresh from the chat service, without the ones being replaced. */
async function historyWithout(
  deps: TurnDeps,
  userId: string,
  chatId: string,
  replaced: string[],
): Promise<MemoryMessage[]> {
  const history = await deps.chat.recentMessages(userId, chatId);
  return trimToBudget(
    history
      .filter((message) => !replaced.includes(message.id))
      .map(({ role, content: text }) => ({ role, content: text })),
  );
}

/** How one turn is set up; send, regenerate and edit differ only in these. */
interface TurnPlan {
  userId: string;
  chat: ChatInfo;
  clientMessageId: string;
  /** The message as the user wrote it, shortcut included. */
  content: string;
  /** What the agent answers, without the shortcut. */
  text: string;
  /** Route the message, or keep the agent of the answer being regenerated. */
  chooseAgent: { chosen?: Agent | undefined } | { fixed: Agent };
  loadMemory: () => Promise<MemoryMessage[]>;
  reserveKey: string;
  /** Save a new user message, or answer an existing one. */
  userMessage: { save: true; agent?: Agent; supersedes: string[] } | { save: false; id: string };
  /** Files sent with the message, still unchecked. */
  attachmentIds: string[];
  answerSupersedes: string[];
  /** Edit and regenerate replace earlier history, so the memory cache is dropped afterwards. */
  historyChanged: boolean;
}

/**
 * Everything that can refuse the request happens here, before the stream starts, so refusals
 * are ordinary error replies: a duplicate in progress, no credits, a reserve that fails.
 */
async function runTurn(deps: TurnDeps, res: Response, plan: TurnPlan): Promise<void> {
  const { userId, chat } = plan;
  const chatId = chat.id;

  // One answer per action at a time: a second copy of the same request is refused.
  const lockKey = `turn-lock:${chatId}:${plan.clientMessageId}`;
  if (!(await deps.redis.set(lockKey, '1', 'EX', LOCK_SECONDS, 'NX'))) {
    throw new AppError('conflict', 'This message is already being answered');
  }
  try {
    // No credits at all: refuse before any AI call, the router's included.
    if ((await deps.billing.balance(userId)) < CREDIT_COSTS.chat) {
      throw new AppError('insufficient_credits', 'You are out of credits');
    }
    const attachments = await resolveAttachments(userId, chatId, plan.attachmentIds);
    const documentsInChat =
      (await DocumentModel.exists({ userId, chatId, status: 'ready' })) !== null;
    // Memory is read before the new message is saved, so the question isn't in it twice.
    const memory = await plan.loadMemory();
    const route: Route =
      'fixed' in plan.chooseAgent
        ? {
            agent: deps.available.has(plan.chooseAgent.fixed) ? plan.chooseAgent.fixed : 'chat',
            reason: 'chosen',
          }
        : await routeMessage(
            {
              text: plan.text,
              chosen: plan.chooseAgent.chosen,
              attachmentKinds: attachments.map((file) => file.purpose),
              documentsInChat,
              available: deps.available,
            },
            deps.llm,
            deps.logger,
          );
    // Each agent has its own per-minute limit: the costly ones are held tighter than chat.
    const limit = await hitRateLimit(
      deps.redis,
      { scope: `agent-${route.agent}`, limit: AGENT_RATE_LIMITS[route.agent] },
      userId,
    );
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new AppError(
        'rate_limited',
        `Too many ${route.agent} requests. Try again in ${limit.retryAfterSeconds}s.`,
      );
    }
    const { reservation } = await deps.billing.reserve(userId, route.agent, plan.reserveKey);
    if (reservation.status !== 'held') {
      throw new AppError('conflict', 'This message was already answered');
    }

    let messageIds: { user: string; answer: string };
    try {
      const userMessageId = plan.userMessage.save
        ? (
            await deps.chat.saveMessage(userId, {
              chatId,
              role: 'user',
              content: plan.content,
              clientMessageId: plan.clientMessageId,
              ...(plan.userMessage.agent ? { agent: plan.userMessage.agent } : {}),
              supersedes: plan.userMessage.supersedes,
              attachments: plan.attachmentIds,
            })
          ).message.id
        : plan.userMessage.id;
      const { message: answer } = await deps.chat.saveMessage(userId, {
        chatId,
        role: 'assistant',
        agent: route.agent,
        status: 'streaming',
        supersedes: plan.answerSupersedes,
      });
      messageIds = { user: userMessageId, answer: answer.id };
    } catch (error) {
      await deps.billing.release(userId, reservation.id).catch(() => undefined);
      throw error;
    }

    await streamAnswer(deps, res, {
      userId,
      chatId,
      content: plan.content,
      text: plan.text,
      memory,
      route,
      reservation,
      messageIds,
      needsTitle: chat.title === DEFAULT_TITLE,
      attachments,
      historyChanged: plan.historyChanged,
    });
  } finally {
    await deps.redis.del(lockKey);
  }
}

/**
 * The files sent with a message, checked: each must be the user's, from this chat and ready, and
 * a PDF must have finished being read. Anything else refuses the message before it is charged.
 */
async function resolveAttachments(
  userId: string,
  chatId: string,
  ids: string[],
): Promise<Attachment[]> {
  if (ids.length === 0) {
    return [];
  }
  const unique = [...new Set(ids)];
  const files = await FileModel.find({
    _id: { $in: unique.filter((value) => mongoose.isValidObjectId(value)) },
    userId,
    chatId,
  });
  if (files.length !== unique.length || files.some((file) => file.status !== 'ready')) {
    throw new AppError('not_found', 'An attached file is missing or not uploaded yet');
  }
  const pdfs = files.filter((file) => file.purpose === 'pdf');
  if (pdfs.length > 0) {
    const documents = await DocumentModel.find({ fileId: { $in: pdfs.map((file) => file._id) } });
    if (documents.some((document) => document.status === 'failed')) {
      throw new AppError('conflict', 'An attached PDF could not be read; upload it again');
    }
    if (
      documents.length !== pdfs.length ||
      documents.some((document) => document.status !== 'ready')
    ) {
      throw new AppError('conflict', 'Still reading your PDF; try again in a moment');
    }
  }
  return files.map((file) => ({
    fileId: file.id,
    purpose: file.purpose === 'image' ? 'image' : 'pdf',
    name: file.name,
    mime: file.mime,
  }));
}

interface Turn {
  attachments: Attachment[];
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
  historyChanged: boolean;
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

  // The user's stop button reaches this answer through Redis, on whichever instance runs it.
  const unregister = await deps.stops.register(turn.messageIds.answer, userId, controller);

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
  let sources: Record<string, unknown>[] | undefined;
  let artifacts: Record<string, unknown>[] | undefined;
  let citations: Record<string, unknown>[] | undefined;
  const fileRefs: string[] = [];

  try {
    for await (const event of runner.run({
      text: turn.text,
      memory: turn.memory,
      userId,
      chatId,
      attachments: turn.attachments,
      llm: deps.llm,
      signal: controller.signal,
      messageId: turn.messageIds.answer,
    })) {
      if (event.type === 'model') {
        model = event.model;
      } else if (event.type === 'progress') {
        stream.send('progress', { step: event.step, current: event.current, total: event.total });
      } else if (event.type === 'file') {
        fileRefs.push(event.file.fileId);
        stream.send('file', event.file);
      } else if (event.type === 'citations') {
        citations = event.items.map((item) => ({ ...item }));
        stream.send('citations', { items: event.items });
      } else if (event.type === 'artifact') {
        artifacts = [{ files: event.files }];
        stream.send('artifact', { files: event.files });
      } else if (event.type === 'sources') {
        sources = event.items.map((item) => ({ ...item }));
        stream.send('sources', { items: event.items });
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
      ...(sources ? { sources } : {}),
      ...(artifacts ? { artifacts } : {}),
      ...(citations ? { citations } : {}),
      ...(fileRefs.length > 0 ? { fileRefs } : {}),
    });
    const committed = await deps.billing.commit(userId, reservation.id, {
      ...(model ? { model } : {}),
      ...usage,
      latencyMs: Date.now() - started,
      chatId,
      messageId: turn.messageIds.answer,
    });
    stream.send('usage', { creditsCharged: reservation.amount, balance: committed.balance });
    if (turn.historyChanged) {
      await deps.memory.forget(chatId);
    } else {
      await deps.memory.append(chatId, [
        { role: 'user', content: turn.content },
        { role: 'assistant', content: text },
      ]);
    }
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
      ...(sources ? { sources } : {}),
    });
  } finally {
    await unregister().catch(() => undefined);
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
  outcome: {
    error: unknown;
    stopped: boolean;
    text: string;
    started: boolean;
    sources?: Record<string, unknown>[];
  },
): Promise<void> {
  const { userId, reservation } = turn;
  const charge = outcome.stopped && outcome.started;
  try {
    await deps.chat.updateMessage(userId, turn.messageIds.answer, {
      content: outcome.text,
      status: outcome.stopped ? 'stopped' : 'failed',
      ...(outcome.sources ? { sources: outcome.sources } : {}),
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

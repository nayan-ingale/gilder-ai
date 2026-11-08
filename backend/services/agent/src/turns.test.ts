import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createApp as createBillingApp } from '@gilder/billing/app';
import { createApp as createChatApp } from '@gilder/chat/app';
import {
  createInternalClient,
  createLogger,
  generateInternalKeyPair,
  importInternalPrivateKey,
  importInternalPublicKey,
  INTERNAL_TOKEN_HEADER,
  type InternalKey,
  type RunningService,
  signInternalToken,
  startService,
} from '@gilder/shared';
import {
  createTestRedis,
  startTestMongo,
  type TestMongo,
  type TestRedis,
} from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chatAgent } from './agents/chat.ts';
import { codeAgent } from './agents/code.ts';
import { createPdfAgent } from './agents/generate.ts';
import { createMemoryFileStore } from './files/file-store.ts';
import { mockImage } from './generate/images.ts';
import { createPdfQaAgent } from './agents/pdf-qa.ts';
import { createSearchAgent } from './agents/search.ts';
import { readyDocuments } from './files/documents.ts';
import { DocumentModel, FileModel } from './files/models.ts';
import { mockEmbedder } from './rag/embeddings.ts';
import { createMemoryVectorStore } from './rag/vector-store.ts';
import { mockWebSearch } from './search/web-search.ts';
import { createApp } from './app.ts';
import { createLlm } from './llm/llm.ts';
import { createMockProvider } from './llm/mock.ts';
import { LlmError, type LlmProvider, type StreamRequest, textOf } from './llm/types.ts';
import { createMemory } from './memory.ts';
import { billingService, chatService } from './services.ts';
import { createStopSignals, type StopSignals } from './stops.ts';

// A whole turn: the agent app with real chat and billing services on their own ports, real
// Redis, and a scripted AI provider.
const logger = createLogger({ service: 'agent', level: 'silent' });
let mongo: TestMongo;
let store: TestRedis;
let stops: StopSignals;
const vectors = createMemoryVectorStore();
let chatApp: RunningService;
let billingApp: RunningService;
let gatewayKey: InternalKey;
let gatewayPublicKey: InternalKey;
let agentKey: InternalKey;
let authKey: InternalKey;

/** What the AI is asked, and what it answers. Each test sets `script`. */
let aiCalls: StreamRequest[] = [];
/** A fresh user per test, so balances and chats never carry over between tests. */
let me = '';
let script: { answer?: (request: StreamRequest) => string; fail?: LlmError; delayMs?: number } = {};

const scriptedProvider: LlmProvider = {
  name: 'mock',
  async *stream(streamRequest) {
    aiCalls.push(streamRequest);
    if (
      script.fail &&
      !streamRequest.json &&
      !textOf(streamRequest.messages[0]?.content ?? '').includes('title')
    ) {
      throw script.fail;
    }
    const mock = createMockProvider({
      delayMs: script.delayMs ?? 0,
      ...(script.answer ? { respond: script.answer } : {}),
    });
    yield* mock.stream(streamRequest);
  },
};

beforeAll(async () => {
  mongo = await startTestMongo({ replicaSet: true });
  const [gateway, agent, auth] = await Promise.all([
    generateInternalKeyPair(),
    generateInternalKeyPair(),
    generateInternalKeyPair(),
  ]);
  gatewayKey = await importInternalPrivateKey(gateway.privateKey);
  gatewayPublicKey = await importInternalPublicKey(gateway.publicKey);
  agentKey = await importInternalPrivateKey(agent.privateKey);
  authKey = await importInternalPrivateKey(auth.privateKey);
  const agentPublicKey = await importInternalPublicKey(agent.publicKey);
  chatApp = await startService(
    createChatApp({ logger, internalPublicKey: gatewayPublicKey, agentPublicKey }),
    { port: 0, logger, handleSignals: false },
  );
  billingApp = await startService(
    createBillingApp({
      logger,
      internalPublicKey: gatewayPublicKey,
      callerKeys: { agent: agentPublicKey, auth: await importInternalPublicKey(auth.publicKey) },
    }),
    { port: 0, logger, handleSignals: false },
  );
}, 120_000);

afterAll(async () => {
  await chatApp.close();
  await billingApp.close();
  await mongo.stop();
});

beforeEach(async () => {
  store = await createTestRedis();
  stops = await createStopSignals(store.redis, logger);
  aiCalls = [];
  script = {};
  me = `user-${randomUUID()}`;
});

afterEach(async () => {
  await stops.close();
  await store.cleanup();
});

function agentApp() {
  const client = (service: 'chat' | 'billing', port: number) =>
    createInternalClient({
      caller: 'agent',
      privateKey: agentKey,
      service,
      baseUrl: `http://localhost:${port}`,
    });
  const chat = chatService(client('chat', chatApp.port));
  return createApp({
    logger,
    internalPublicKey: gatewayPublicKey,
    turns: {
      llm: createLlm({ mode: 'mock', providers: { mock: scriptedProvider }, logger }),
      chat,
      billing: billingService(client('billing', billingApp.port)),
      memory: createMemory(store.redis, async (chatId, userId) =>
        (await chat.recentMessages(userId, chatId)).map(({ role, content }) => ({ role, content })),
      ),
      redis: store.redis,
      agents: {
        chat: chatAgent,
        search: createSearchAgent(mockWebSearch),
        code: codeAgent,
        pdf_qa: createPdfQaAgent({ embedder: mockEmbedder, vectors, documentsFor: readyDocuments }),
        pdf: createPdfAgent({ store: createMemoryFileStore(), drawImage: mockImage, mode: 'mock' }),
      },
      available: new Set(['chat', 'search', 'code', 'pdf_qa', 'pdf']),
      stops,
    },
  });
}

const gatewayToken = (userId: string, audience: string) =>
  signInternalToken(gatewayKey, audience, { userId });

async function newChat(userId: string): Promise<string> {
  const response = await request(`http://localhost:${chatApp.port}`)
    .post('/chats')
    .set(INTERNAL_TOKEN_HEADER, await gatewayToken(userId, 'chat'))
    .send({});
  return response.body.chat.id as string;
}

async function grantCredits(userId: string) {
  await request(`http://localhost:${billingApp.port}`)
    .post('/internal/accounts')
    .set(
      INTERNAL_TOKEN_HEADER,
      await signInternalToken(authKey, 'billing', { userId }, 60, 'auth'),
    );
}

async function balanceOf(userId: string): Promise<number> {
  const response = await request(`http://localhost:${billingApp.port}`)
    .get('/account')
    .set(INTERNAL_TOKEN_HEADER, await gatewayToken(userId, 'billing'));
  return response.body.account.balance as number;
}

async function historyOf(userId: string, chatId: string) {
  const response = await request(`http://localhost:${chatApp.port}`)
    .get(`/chats/${chatId}/messages`)
    .set(INTERNAL_TOKEN_HEADER, await gatewayToken(userId, 'chat'));
  return response.body.items as {
    id: string;
    role: string;
    content: string;
    status: string;
    agent: string;
    sources: { n: number; url: string }[];
    artifacts: { files: { name: string }[] }[];
  }[];
}

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function parseEvents(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((block) => block.startsWith('event: '))
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n');
      return {
        event: eventLine?.slice('event: '.length) ?? '',
        data: JSON.parse(dataLine?.slice('data: '.length) ?? '{}') as Record<string, unknown>,
      };
    });
}

async function sendTurn(userId: string, chatId: string, body: Record<string, unknown>) {
  return request(agentApp())
    .post(`/chats/${chatId}/turns`)
    .set(INTERNAL_TOKEN_HEADER, await gatewayToken(userId, 'agent'))
    .send(body);
}

describe('POST /chats/:chatId/turns', () => {
  it('streams the answer, saves both messages, charges the credits and titles the chat', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.answer = (streamRequest) =>
      streamRequest.json
        ? '{"agent":"chat","confidence":0.9}'
        : textOf(streamRequest.messages[0]?.content ?? '').includes('title')
          ? '"Goa Trip Plan."'
          : 'Day 1: beaches. Day 2: forts.';

    const response = await sendTurn(me, chatId, {
      content: 'Plan a 2-day Goa trip',
      clientMessageId: 'client-0001',
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/event-stream/);
    const events = parseEvents(response.text);
    expect(events.map((event) => event.event).filter((name) => name !== 'token')).toEqual([
      'meta',
      'agent',
      'usage',
      'title',
      'done',
    ]);
    const answer = events
      .filter((event) => event.event === 'token')
      .map((event) => event.data.text)
      .join('');
    expect(answer).toBe('Day 1: beaches. Day 2: forts.');
    expect(events.find((event) => event.event === 'agent')?.data).toEqual({
      agent: 'chat',
      reason: 'router',
    });
    expect(events.find((event) => event.event === 'usage')?.data).toEqual({
      creditsCharged: 1,
      balance: 99,
    });
    expect(events.find((event) => event.event === 'title')?.data).toEqual({
      title: 'Goa Trip Plan',
    });

    const history = await historyOf(me, chatId);
    expect(history).toMatchObject([
      { role: 'user', content: 'Plan a 2-day Goa trip', status: 'complete' },
      { role: 'assistant', content: answer, status: 'complete', agent: 'chat' },
    ]);
    expect(await balanceOf(me)).toBe(99);
    expect(await store.redis.exists(`turn-lock:${chatId}:client-0001`)).toBe(0);
  });

  it('sends the earlier conversation as memory on the next turn', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.answer = (streamRequest) =>
      streamRequest.json ? '{"agent":"chat","confidence":1}' : 'ok';
    await sendTurn(me, chatId, { content: 'My name is Nayan', clientMessageId: 'client-0001' });
    aiCalls = [];

    await sendTurn(me, chatId, { content: 'What is my name?', clientMessageId: 'client-0002' });

    const answerCall = aiCalls.find(
      (call) => !call.json && call.messages.at(-1)?.content === 'What is my name?',
    );
    expect(answerCall?.messages.slice(1)).toEqual([
      { role: 'user', content: 'My name is Nayan' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'What is my name?' },
    ]);
  });

  it('refuses with 402 and calls no AI at all when the user has no credits (SEC-03)', async () => {
    const chatId = await newChat('broke');

    const response = await sendTurn('broke', chatId, {
      content: 'Hello',
      clientMessageId: 'client-0001',
    });

    expect(response.status).toBe(402);
    expect(response.body.code).toBe('insufficient_credits');
    expect(aiCalls).toEqual([]);
    expect(await historyOf('broke', chatId)).toEqual([]);
  });

  it("gives a 404 for someone else's chat, before any AI call or charge", async () => {
    const chatId = await newChat('owner');
    await grantCredits('intruder');

    const response = await sendTurn('intruder', chatId, {
      content: 'Hello',
      clientMessageId: 'client-0001',
    });

    expect(response.status).toBe(404);
    expect(aiCalls).toEqual([]);
    expect(await balanceOf('intruder')).toBe(100);
  });

  it('answers a message once: a resend gets 409, and one in progress is locked', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    const body = { content: 'Hello', clientMessageId: 'client-0001' };
    await sendTurn(me, chatId, body);

    const resend = await sendTurn(me, chatId, body);
    await store.redis.set(`turn-lock:${chatId}:client-0002`, '1');
    const parallel = await sendTurn(me, chatId, { ...body, clientMessageId: 'client-0002' });

    expect(resend.status).toBe(409);
    expect(resend.body.detail).toBe('This message was already answered');
    expect(parallel.status).toBe(409);
    expect(parallel.body.detail).toBe('This message is already being answered');
    expect(await balanceOf(me)).toBe(99);
    expect(await historyOf(me, chatId)).toHaveLength(2);
  });

  it('holds each agent to its per-minute limit, before charging anything', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    await store.redis.set(`rl:agent-chat:${me}`, '20', 'EX', 60);

    const response = await sendTurn(me, chatId, {
      content: 'Hello',
      clientMessageId: 'client-0001',
    });

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
    expect(await balanceOf(me)).toBe(100);
    expect(await historyOf(me, chatId)).toEqual([]);
  });

  it('refuses a shortcut with no message and malformed bodies', async () => {
    const chatId = await newChat(me);

    for (const body of [
      { content: '/search', clientMessageId: 'client-0001' },
      { content: '', clientMessageId: 'client-0001' },
      { content: 'hi', clientMessageId: 'bad id!' },
      { content: 'hi', clientMessageId: 'client-0001', agent: 'robot' },
    ]) {
      expect((await sendTurn(me, chatId, body)).status).toBe(400);
    }
  });

  it('gives the credits back and says why when the AI fails before answering', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.fail = new LlmError('mock', 'provider down', { retryable: false, status: 400 });

    const response = await sendTurn(me, chatId, {
      content: 'Hello',
      clientMessageId: 'client-0001',
    });

    const events = parseEvents(response.text);
    expect(events.map((event) => event.event)).toEqual(['meta', 'agent', 'error', 'done']);
    expect(events[2]?.data).toMatchObject({
      code: 'answer_failed',
      message: 'The answer failed. Your credits were not charged.',
    });
    expect(await balanceOf(me)).toBe(100);
    expect((await historyOf(me, chatId)).at(-1)).toMatchObject({
      role: 'assistant',
      status: 'failed',
    });
  });

  it('charges a stop after text started, keeping the partial answer as stopped', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.delayMs = 20;
    script.answer = (streamRequest) =>
      streamRequest.json ? '{"agent":"chat","confidence":1}' : 'one two three four five six seven';

    // A real HTTP client that hangs up after the first token, like a closed tab or a stop.
    const server = await startService(agentApp(), { port: 0, logger, handleSignals: false });
    try {
      const token = await gatewayToken(me, 'agent');
      await new Promise<void>((resolve, reject) => {
        const req = httpRequest(
          {
            port: server.port,
            method: 'POST',
            path: `/chats/${chatId}/turns`,
            headers: { 'content-type': 'application/json', [INTERNAL_TOKEN_HEADER]: token },
          },
          (res) => {
            res.on('data', (chunk: Buffer) => {
              if (chunk.toString().includes('event: token')) {
                req.destroy();
                resolve();
              }
            });
          },
        );
        req.on('error', (error) => {
          if (!req.destroyed) {
            reject(error);
          }
        });
        req.end(JSON.stringify({ content: 'Count to seven', clientMessageId: 'client-0001' }));
      });

      await expect
        .poll(async () => (await historyOf(me, chatId)).at(-1)?.status, { timeout: 5_000 })
        .toBe('stopped');
      const answer = (await historyOf(me, chatId)).at(-1)?.content ?? '';
      expect(answer.length).toBeGreaterThan(0);
      expect(answer).not.toBe('one two three four five six seven');
      await expect.poll(() => balanceOf(me), { timeout: 5_000 }).toBe(99);
    } finally {
      await server.close();
    }
  });
});

/** Sends a turn and returns its parsed events. */
async function turnEvents(path: string, userId: string, body: Record<string, unknown>) {
  const response = await request(agentApp())
    .post(path)
    .set(INTERNAL_TOKEN_HEADER, await gatewayToken(userId, 'agent'))
    .send(body);
  return { response, events: response.status === 200 ? parseEvents(response.text) : [] };
}

const tokensOf = (events: SseEvent[]) =>
  events
    .filter((event) => event.event === 'token')
    .map((event) => event.data.text)
    .join('');

describe('the search agent in a turn', () => {
  it('streams the sources, saves them with the answer and charges 5 credits', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.answer = () => 'Here is what I found [1].';

    const { events } = await turnEvents(`/chats/${chatId}/turns`, me, {
      content: '/search latest TypeScript',
      clientMessageId: 'client-0001',
    });

    expect(events.find((event) => event.event === 'agent')?.data).toEqual({
      agent: 'search',
      reason: 'chosen',
    });
    const sources = events.find((event) => event.event === 'sources')?.data.items as {
      n: number;
    }[];
    expect(sources.map((source) => source.n)).toEqual([1, 2]);
    const answer = (await historyOf(me, chatId)).at(-1);
    expect(answer).toMatchObject({ agent: 'search', status: 'complete' });
    expect(answer?.sources.map((source) => source.url)).toEqual([
      'https://example.com/one',
      'https://example.org/two',
    ]);
    expect(await balanceOf(me)).toBe(95);
  });
});

describe('the code agent in a turn', () => {
  it('streams the code, sends and saves the files, and charges 10 credits', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.answer = () =>
      'A page.\n\n### `index.html`\n```html\n<h1>Hi</h1>\n```\n\n### `script.js`\n```js\nconsole.log(1);\n```';

    const { events } = await turnEvents(`/chats/${chatId}/turns`, me, {
      content: 'a hello page',
      clientMessageId: 'client-0001',
      agent: 'code',
    });

    const artifact = events.find((event) => event.event === 'artifact')?.data.files as {
      name: string;
    }[];
    expect(artifact.map((file) => file.name)).toEqual(['index.html', 'script.js']);
    const answer = (await historyOf(me, chatId)).at(-1);
    expect(answer?.agent).toBe('code');
    expect(answer?.artifacts[0]?.files.map((file) => file.name)).toEqual([
      'index.html',
      'script.js',
    ]);
    expect(await balanceOf(me)).toBe(90);
  });
});

describe('attachments', () => {
  async function uploadedPdf(userId: string, chatId: string, status: 'ready' | 'indexing') {
    const file = await FileModel.create({
      userId,
      chatId,
      kind: 'upload',
      purpose: 'pdf',
      name: 'policy.pdf',
      s3Key: `users/${userId}/uploads/x`,
      mime: 'application/pdf',
      sizeBytes: 100,
      status: 'ready',
      pageCount: 1,
    });
    const document = await DocumentModel.create({
      fileId: file._id,
      userId,
      chatId,
      pageCount: 1,
      status,
    });
    const [vector] = await mockEmbedder.embed(['Refunds take seven working days.'], 'document');
    await vectors.upsert([
      {
        vector: vector ?? [],
        payload: {
          userId,
          documentId: document.id,
          chatId,
          page: 1,
          text: 'Refunds take seven working days.',
        },
      },
    ]);
    return file.id as string;
  }

  it('answers an attached PDF with cited pages, saving the attachment and citations', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    const fileId = await uploadedPdf(me, chatId, 'ready');
    script.answer = () => 'Seven working days [p. 1].';

    const { events } = await turnEvents(`/chats/${chatId}/turns`, me, {
      content: 'How long do refunds take?',
      clientMessageId: 'client-0001',
      attachments: [fileId],
    });

    expect(events.find((event) => event.event === 'agent')?.data).toEqual({
      agent: 'pdf_qa',
      reason: 'attachment',
    });
    const citations = events.find((event) => event.event === 'citations')?.data.items as {
      page: number;
    }[];
    expect(citations[0]?.page).toBe(1);
    const history = await request(`http://localhost:${chatApp.port}`)
      .get(`/chats/${chatId}/messages`)
      .set(INTERNAL_TOKEN_HEADER, await gatewayToken(me, 'chat'));
    expect(history.body.items[0].attachments).toEqual([fileId]);
    expect(history.body.items[1].citations[0]).toMatchObject({ name: 'policy.pdf', page: 1 });
    expect(await balanceOf(me)).toBe(90);
  });

  it('waits for a PDF still being read, and refuses files from other chats or users', async () => {
    const chatId = await newChat(me);
    const otherChat = await newChat(me);
    await grantCredits(me);
    const reading = await uploadedPdf(me, chatId, 'indexing');
    const elsewhere = await uploadedPdf(me, otherChat, 'ready');
    const theirs = await uploadedPdf('someone-else', chatId, 'ready');

    const send = (fileId: string, n: number) =>
      sendTurn(me, chatId, {
        content: 'Question',
        clientMessageId: `client-000${n}`,
        attachments: [fileId],
      });

    expect((await send(reading, 1)).status).toBe(409);
    expect((await send(elsewhere, 2)).status).toBe(404);
    expect((await send(theirs, 3)).status).toBe(404);
    expect(await balanceOf(me)).toBe(100);
  });
});

describe('file generation in a turn', () => {
  it('streams progress and the file, saves it on the answer and charges 10 credits', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);

    const { events } = await turnEvents(`/chats/${chatId}/turns`, me, {
      content: '/pdf a packing list for Goa',
      clientMessageId: 'client-0001',
    });

    expect(events.filter((event) => event.event === 'progress')).toHaveLength(3);
    const file = events.find((event) => event.event === 'file')?.data as {
      fileId: string;
      kind: string;
      url: string;
    };
    expect(file).toMatchObject({ kind: 'pdf' });
    expect(file.url).toContain('signed=1');
    const history = await request(`http://localhost:${chatApp.port}`)
      .get(`/chats/${chatId}/messages`)
      .set(INTERNAL_TOKEN_HEADER, await gatewayToken(me, 'chat'));
    expect(history.body.items[1].fileRefs).toEqual([file.fileId]);
    expect(await balanceOf(me)).toBe(90);
  });
});

describe('regenerate and edit', () => {
  it('regenerates the latest answer with the same agent, hiding the old one', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    let version = 0;
    script.answer = (streamRequest) =>
      streamRequest.json
        ? '{"agent":"chat","confidence":1}'
        : textOf(streamRequest.messages[0]?.content ?? '').includes('short title')
          ? 'A title'
          : `answer v${(version += 1)}`;
    await sendTurn(me, chatId, { content: 'Earlier question', clientMessageId: 'client-0001' });
    await sendTurn(me, chatId, { content: 'Tell me a joke', clientMessageId: 'client-0002' });
    const old = (await historyOf(me, chatId)).at(-1);
    aiCalls = [];

    const { events } = await turnEvents(`/chats/${chatId}/messages/${old?.id}/regenerate`, me, {
      clientMessageId: 'regen-0001',
    });

    expect(tokensOf(events)).toBe('answer v3');
    expect(events.find((event) => event.event === 'agent')?.data).toEqual({
      agent: 'chat',
      reason: 'chosen',
    });
    // The question is asked again with the earlier turn as memory, not the replaced answer.
    const answerCall = aiCalls.find((call) => !call.json);
    expect(answerCall?.messages.slice(1)).toEqual([
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'answer v1' },
      { role: 'user', content: 'Tell me a joke' },
    ]);
    const history = await historyOf(me, chatId);
    expect(history.map((message) => message.content)).toEqual([
      'Earlier question',
      'answer v1',
      'Tell me a joke',
      'answer v3',
    ]);
    expect(await balanceOf(me)).toBe(97);
  });

  it('edits the latest message: the old message and answer are replaced', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.answer = (streamRequest) =>
      streamRequest.json ? '{"agent":"chat","confidence":1}' : 'reply';
    await sendTurn(me, chatId, { content: 'Plan a trip to Goa', clientMessageId: 'client-0001' });
    const question = (await historyOf(me, chatId))[0];

    const { events } = await turnEvents(`/chats/${chatId}/messages/${question?.id}/edit`, me, {
      content: 'Plan a trip to Kerala',
      clientMessageId: 'client-0002',
    });

    expect(events.at(-1)?.event).toBe('done');
    expect((await historyOf(me, chatId)).map((message) => message.content)).toEqual([
      'Plan a trip to Kerala',
      'reply',
    ]);
  });

  it('only acts on the latest turn', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    await sendTurn(me, chatId, { content: 'one', clientMessageId: 'client-0001' });
    await sendTurn(me, chatId, { content: 'two', clientMessageId: 'client-0002' });
    const [firstQuestion, firstAnswer] = await historyOf(me, chatId);

    const regenerate = await turnEvents(
      `/chats/${chatId}/messages/${firstAnswer?.id}/regenerate`,
      me,
      { clientMessageId: 'regen-0001' },
    );
    const edit = await turnEvents(`/chats/${chatId}/messages/${firstQuestion?.id}/edit`, me, {
      content: 'changed',
      clientMessageId: 'client-0003',
    });

    expect(regenerate.response.status).toBe(409);
    expect(edit.response.status).toBe(409);
    expect(await balanceOf(me)).toBe(98);
  });
});

describe('POST /turns/:turnId/stop', () => {
  it('stops a running answer for its owner, charging the text already sent', async () => {
    const chatId = await newChat(me);
    await grantCredits(me);
    script.delayMs = 25;
    script.answer = (streamRequest) =>
      streamRequest.json
        ? '{"agent":"chat","confidence":1}'
        : Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');

    const server = await startService(agentApp(), { port: 0, logger, handleSignals: false });
    try {
      const token = await gatewayToken(me, 'agent');
      const body = await new Promise<string>((resolve, reject) => {
        let text = '';
        let stopSent = false;
        const req = httpRequest(
          {
            port: server.port,
            method: 'POST',
            path: `/chats/${chatId}/turns`,
            headers: { 'content-type': 'application/json', [INTERNAL_TOKEN_HEADER]: token },
          },
          (res) => {
            res.on('data', (chunk: Buffer) => {
              text += chunk.toString();
              const turnId = /"turnId":"([a-f0-9]+)"/.exec(text)?.[1];
              if (turnId && !stopSent && text.includes('event: token')) {
                stopSent = true;
                void (async () => {
                  const other = await request(agentApp())
                    .post(`/turns/${turnId}/stop`)
                    .set(INTERNAL_TOKEN_HEADER, await gatewayToken('someone-else', 'agent'));
                  expect(other.status).toBe(404);
                  const stop = await request(agentApp())
                    .post(`/turns/${turnId}/stop`)
                    .set(INTERNAL_TOKEN_HEADER, token);
                  expect(stop.status).toBe(202);
                })().catch(reject);
              }
            });
            res.on('end', () => resolve(text));
          },
        );
        req.on('error', reject);
        req.end(JSON.stringify({ content: 'Count', clientMessageId: 'client-0001' }));
      });

      const events = parseEvents(body);
      expect(events.at(-1)?.event).toBe('done');
      expect(events.some((event) => event.event === 'usage')).toBe(true);
      const answer = (await historyOf(me, chatId)).at(-1);
      expect(answer?.status).toBe('stopped');
      expect(answer?.content.split(' ').length).toBeLessThan(40);
      expect(await balanceOf(me)).toBe(99);
    } finally {
      await server.close();
    }
  });
});

describe('the agent app', () => {
  it('refuses a direct call without the gateway token', async () => {
    const response = await request(agentApp()).post('/chats/x/turns').send({});

    expect(response.status).toBe(401);
  });
});

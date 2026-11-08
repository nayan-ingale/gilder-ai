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
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { billingService, chatService } from './services.ts';

// The agent's clients against the real chat and billing services, each on its own port, with
// the agent's own key, as in development.
const logger = createLogger({ service: 'agent', level: 'silent' });
let mongo: TestMongo;
let chatApp: RunningService;
let billingApp: RunningService;
let gatewayKey: InternalKey;
let authKey: InternalKey;
let chat: ReturnType<typeof chatService>;
let billing: ReturnType<typeof billingService>;

beforeAll(async () => {
  mongo = await startTestMongo({ replicaSet: true });
  const [gateway, agent, auth] = await Promise.all([
    generateInternalKeyPair(),
    generateInternalKeyPair(),
    generateInternalKeyPair(),
  ]);
  gatewayKey = await importInternalPrivateKey(gateway.privateKey);
  authKey = await importInternalPrivateKey(auth.privateKey);
  const gatewayPublicKey = await importInternalPublicKey(gateway.publicKey);
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
  const agentKey = await importInternalPrivateKey(agent.privateKey);
  chat = chatService(
    createInternalClient({
      caller: 'agent',
      privateKey: agentKey,
      service: 'chat',
      baseUrl: `http://localhost:${chatApp.port}`,
    }),
  );
  billing = billingService(
    createInternalClient({
      caller: 'agent',
      privateKey: agentKey,
      service: 'billing',
      baseUrl: `http://localhost:${billingApp.port}`,
    }),
  );
}, 120_000);

afterAll(async () => {
  await chatApp.close();
  await billingApp.close();
  await mongo.stop();
});

/** A chat made the way the browser makes one: through its public route. */
async function newChat(userId: string): Promise<string> {
  const response = await request(`http://localhost:${chatApp.port}`)
    .post('/chats')
    .set(INTERNAL_TOKEN_HEADER, await signInternalToken(gatewayKey, 'chat', { userId }))
    .send({});
  return response.body.chat.id as string;
}

describe('chatService', () => {
  it('reads the chat, saves and fills in messages, reads history and names the chat', async () => {
    const chatId = await newChat('u1');

    expect((await chat.getChat('u1', chatId)).title).toBe('New chat');
    const user = await chat.saveMessage('u1', {
      chatId,
      role: 'user',
      content: 'Plan a Goa trip',
      clientMessageId: 'client-1',
    });
    const retried = await chat.saveMessage('u1', {
      chatId,
      role: 'user',
      content: 'Plan a Goa trip',
      clientMessageId: 'client-1',
    });
    const answer = await chat.saveMessage('u1', {
      chatId,
      role: 'assistant',
      agent: 'chat',
      status: 'streaming',
    });
    await chat.updateMessage('u1', answer.message.id, {
      content: 'Day 1: beaches',
      status: 'complete',
    });
    await chat.autoTitle('u1', chatId, 'Goa trip plan');

    expect(user.created).toBe(true);
    expect(retried).toMatchObject({ created: false, message: { id: user.message.id } });
    expect(await chat.recentMessages('u1', chatId)).toMatchObject([
      { role: 'user', content: 'Plan a Goa trip' },
      { role: 'assistant', content: 'Day 1: beaches' },
    ]);
    expect((await chat.getChat('u1', chatId)).title).toBe('Goa trip plan');
  });

  it("gets a 404 for another user's chat", async () => {
    const chatId = await newChat('u1');

    await expect(chat.getChat('u2', chatId)).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      chat.saveMessage('u2', { chatId, role: 'user', content: 'sneaky' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('billingService', () => {
  it('reserves, commits and releases, and keeps the 402 when credits run out', async () => {
    // The sign-up grant, as auth asks for it.
    await request(`http://localhost:${billingApp.port}`)
      .post('/internal/accounts')
      .set(
        INTERNAL_TOKEN_HEADER,
        await signInternalToken(authKey, 'billing', { userId: 'u1' }, 60, 'auth'),
      );

    const held = await billing.reserve('u1', 'code', 'turn-0000001');
    const committed = await billing.commit('u1', held.reservation.id, {
      model: 'm',
      outputTokens: 3,
    });
    const second = await billing.reserve('u1', 'chat', 'turn-0000002');
    const released = await billing.release('u1', second.reservation.id);

    expect(held).toMatchObject({ reservation: { amount: 10, status: 'held' }, balance: 90 });
    expect(committed.reservation.status).toBe('committed');
    expect(released).toMatchObject({ reservation: { status: 'released' }, balance: 90 });
    await expect(billing.reserve('broke-user', 'chat', 'turn-0000003')).rejects.toMatchObject({
      code: 'insufficient_credits',
      status: 402,
    });
  });
});

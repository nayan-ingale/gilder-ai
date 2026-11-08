import {
  connectMongo,
  createInternalClient,
  createLogger,
  createRedis,
  disconnectMongo,
  importInternalPrivateKey,
  importInternalPublicKey,
  pingMongo,
  pingRedis,
  startService,
} from '@gilder/shared';
import { availableAgents, buildAgents } from './agents/index.ts';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { createLlm } from './llm/llm.ts';
import { buildProviders } from './llm/providers.ts';
import { createMemory } from './memory.ts';
import { createTavilySearch, mockWebSearch } from './search/web-search.ts';
import { billingService, chatService } from './services.ts';
import { createStopSignals } from './stops.ts';
import { llmCallRecorder } from './telemetry.ts';

const logger = createLogger({
  service: 'agent',
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

await connectMongo(env.MONGODB_URI, logger);
const redis = createRedis(env.REDIS_URL, logger);

const signingKey = await importInternalPrivateKey(env.SERVICE_PRIVATE_KEY);
const chat = chatService(
  createInternalClient({
    caller: 'agent',
    privateKey: signingKey,
    service: 'chat',
    baseUrl: env.CHAT_SERVICE_URL,
  }),
);
const billing = billingService(
  createInternalClient({
    caller: 'agent',
    privateKey: signingKey,
    service: 'billing',
    baseUrl: env.BILLING_SERVICE_URL,
  }),
);

const llm = createLlm({
  mode: env.LLM_MODE,
  providers: buildProviders({
    groq: env.GROQ_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
    gemini: env.GEMINI_API_KEY,
  }),
  logger,
  onCall: llmCallRecorder(logger),
});
logger.info(
  { llmMode: env.LLM_MODE },
  'AI answers are %s',
  env.LLM_MODE === 'live' ? 'live' : 'mocked',
);

const stops = await createStopSignals(redis, logger);
const agents = buildAgents({
  webSearch:
    env.LLM_MODE === 'mock'
      ? mockWebSearch
      : env.TAVILY_API_KEY
        ? createTavilySearch(env.TAVILY_API_KEY)
        : undefined,
});
logger.info({ agents: [...availableAgents(agents)] }, 'agents ready');

const app = createApp({
  logger,
  readinessChecks: { mongo: pingMongo, redis: () => pingRedis(redis) },
  internalPublicKey: await importInternalPublicKey(env.INTERNAL_PUBLIC_KEY),
  turns: {
    llm,
    chat,
    billing,
    memory: createMemory(redis, async (chatId, userId) =>
      (await chat.recentMessages(userId, chatId)).map(({ role, content }) => ({ role, content })),
    ),
    redis,
    agents,
    available: availableAgents(agents),
    stops,
  },
});

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    await stops.close();
    await disconnectMongo();
    await redis.quit();
  },
});

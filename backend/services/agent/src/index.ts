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
import { readyDocuments } from './files/documents.ts';
import { createS3FileStore } from './files/file-store.ts';
import { mockImage, pollinationsImage } from './generate/images.ts';
import { FileModel } from './files/models.ts';
import { startFileCleanup } from './rag/cleanup.ts';
import { createGeminiEmbedder, mockEmbedder } from './rag/embeddings.ts';
import { indexPdf } from './rag/indexer.ts';
import { createMemoryVectorStore, createQdrantStore } from './rag/vector-store.ts';
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

const { AWS_REGION: region, S3_BUCKET: bucket, AWS_ACCESS_KEY_ID: accessKeyId } = env;
const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
const fileStore =
  region && bucket && accessKeyId && secretAccessKey
    ? createS3FileStore({ region, bucket, accessKeyId, secretAccessKey })
    : undefined;
if (!fileStore) {
  logger.warn(
    'uploads are off: set AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY',
  );
}

// PDF questions: Gemini embeddings and Qdrant in live mode; stand-ins in mock mode.
const embedder =
  env.LLM_MODE === 'live' && env.GEMINI_API_KEY
    ? createGeminiEmbedder(env.GEMINI_API_KEY)
    : mockEmbedder;
const vectors = env.QDRANT_URL ? createQdrantStore(env.QDRANT_URL) : createMemoryVectorStore();
const stopCleanup = startFileCleanup({ chat, store: fileStore, vectors, logger });

const agents = buildAgents({
  webSearch:
    env.LLM_MODE === 'mock'
      ? mockWebSearch
      : env.TAVILY_API_KEY
        ? createTavilySearch(env.TAVILY_API_KEY)
        : undefined,
  // PDF and image questions read uploaded files, so they need storage (and Gemini when live).
  ...(fileStore
    ? {
        pdfQa: { embedder, vectors, documentsFor: readyDocuments },
        generate: {
          store: fileStore,
          drawImage: env.LLM_MODE === 'mock' ? mockImage : pollinationsImage,
          mode: env.LLM_MODE,
        },
        ...(env.LLM_MODE === 'mock' || env.GEMINI_API_KEY
          ? {
              imageQa: {
                readImage: async (fileId: string) => {
                  const file = await FileModel.findById(fileId);
                  if (!file) {
                    throw new Error(`file ${fileId} is gone`);
                  }
                  return fileStore.read(file.s3Key);
                },
              },
            }
          : {}),
      }
    : {}),
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
  files: {
    store: fileStore,
    chat,
    onPdfReady: (file) => {
      if (fileStore) {
        void indexPdf(file, { store: fileStore, embedder, vectors, logger });
      }
    },
  },
});

await startService(app, {
  port: env.PORT,
  logger,
  onShutdown: async () => {
    stopCleanup();
    await stops.close();
    await disconnectMongo();
    await redis.quit();
  },
});

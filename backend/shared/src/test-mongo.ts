import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import { createLogger } from './logger.ts';
import { connectMongo, disconnectMongo } from './mongo.ts';

export interface TestMongo {
  /** Disconnects Mongoose and stops the server. Call it in afterAll. */
  stop: () => Promise<void>;
}

export interface TestMongoOptions {
  /**
   * Start a one-member replica set instead of a single server. Transactions need one, as in
   * development and production; it takes a little longer to start.
   */
  replicaSet?: boolean;
}

/**
 * A real MongoDB for one test file, with Mongoose connected to it. mongodb-memory-server
 * downloads and starts a mongod process, so no Docker is needed. Each call starts its own
 * server, so test files running at the same time never share data.
 */
export async function startTestMongo(options: TestMongoOptions = {}): Promise<TestMongo> {
  const server = options.replicaSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
    : await MongoMemoryServer.create();
  await connectMongo(
    server.getUri('gilder_test'),
    createLogger({ service: 'test', level: 'silent' }),
  );
  return {
    stop: async () => {
      await disconnectMongo();
      await server.stop();
    },
  };
}

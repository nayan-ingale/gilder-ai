import mongoose from 'mongoose';
import type { Logger } from './logger.ts';

/**
 * Connects Mongoose and waits until the connection is usable, so an app never starts serving
 * requests without its database. The URI is never logged: it can contain credentials.
 */
export async function connectMongo(uri: string, logger: Logger): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
  logger.info({ database: mongoose.connection.name }, 'mongodb connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

/** Readiness check: fails unless the connection is open and the server answers a ping. */
export async function pingMongo(): Promise<void> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected || !db) {
    throw new Error('mongodb is not connected');
  }
  await db.admin().ping();
}

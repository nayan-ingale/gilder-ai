/**
 * Helpers for the apps' tests, imported as `@gilder/shared/testing`. They start real data stores,
 * so they are kept out of the main entry that the running apps import.
 */
export { startTestMongo, type TestMongo } from './test-mongo.ts';
export { createTestRedis, type TestRedis } from './test-redis.ts';

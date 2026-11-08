import { getContext, type InferSchemaType, type Logger, mongoose } from '@gilder/shared';
import type { LlmCallRecord } from './llm/llm.ts';
import { PROVIDER_NAMES } from './llm/types.ts';

/**
 * Every model attempt, saved for the usage page: who, which model, how many tokens, how fast
 * the first token came, and how it ended. Saving is fire-and-forget: telemetry must never slow
 * down or break an answer.
 */

const { Schema } = mongoose;

const llmCallSchema = new Schema(
  {
    requestId: { type: String, default: null },
    userId: { type: String, default: null },
    messageId: { type: String, default: null },
    agent: { type: String, default: null },
    purpose: { type: String, required: true },
    provider: { type: String, enum: PROVIDER_NAMES, required: true },
    model: { type: String, required: true },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    ttftMs: { type: Number, default: null },
    latencyMs: { type: Number, required: true },
    status: { type: String, enum: ['ok', 'error', 'stopped'], required: true },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'llmCalls' },
);
// The usage page: one user's calls, newest first.
llmCallSchema.index({ userId: 1, createdAt: -1 });

export type LlmCall = InferSchemaType<typeof llmCallSchema>;
export const LlmCallModel = mongoose.model('LlmCall', llmCallSchema);

/** The `onCall` hook for createLlm: adds the request's user and ID, and saves the record. */
export function llmCallRecorder(logger: Logger): (record: LlmCallRecord) => void {
  return (record) => {
    const context = getContext();
    LlmCallModel.create({
      ...record,
      requestId: context?.requestId ?? null,
      userId: context?.userId ?? null,
    }).catch((error: unknown) => {
      logger.warn({ err: error }, 'could not save an AI call record');
    });
  };
}

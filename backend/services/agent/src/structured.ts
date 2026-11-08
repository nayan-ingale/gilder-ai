import { AppError, z } from '@gilder/shared';
import type { Llm, LlmCall, LlmResult } from './llm/llm.ts';

/**
 * Asks a model for JSON and checks it against a schema. A reply that doesn't parse or doesn't
 * fit gets one repair attempt (the model sees its reply and the problem); a second failure is a
 * typed error, never an unchecked object passed along.
 */

export interface StructuredResult<T> {
  value: T;
  /** The call that produced the accepted reply, for telemetry. */
  result: LlmResult;
}

function check<T>(
  schema: z.ZodType<T>,
  text: string,
): { ok: true; value: T } | { ok: false; problem: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'It was not valid JSON.' };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, problem: z.prettifyError(result.error) };
  }
  return { ok: true, value: result.data };
}

export async function completeJson<T>(
  llm: Llm,
  call: LlmCall,
  schema: z.ZodType<T>,
): Promise<StructuredResult<T>> {
  const first = await llm.complete({ ...call, json: true });
  const firstCheck = check(schema, first.text);
  if (firstCheck.ok) {
    return { value: firstCheck.value, result: first };
  }

  const repaired = await llm.complete({
    ...call,
    json: true,
    messages: [
      ...call.messages,
      { role: 'assistant', content: first.text },
      {
        role: 'user',
        content: `That reply did not match the required format. ${firstCheck.problem} Reply again with only the corrected JSON object.`,
      },
    ],
  });
  const secondCheck = check(schema, repaired.text);
  if (secondCheck.ok) {
    return { value: secondCheck.value, result: repaired };
  }
  throw new AppError('service_unavailable', 'The AI returned an answer in the wrong format');
}

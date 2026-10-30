import type { z } from 'zod';

import { Errors } from '@/lib/errors';
import { validationMessage } from '@/lib/schemas/common';

export async function parseRequestBody<T>(request: Request, schema: z.ZodType<T>) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return { ok: false as const, response: Errors.badRequest('Invalid JSON body') };
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    return { ok: false as const, response: Errors.badRequest(validationMessage(result.error)) };
  }
  return { ok: true as const, data: result.data };
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { applyBypassToken, BypassTokenError } from '@/lib/bypass';
import { Errors } from '@/lib/errors';

/**
 * POST /api/bypass/apply
 * Apply (activate) a bypass token for the currently authenticated user.
 * Idempotent: calling twice is safe.
 *
 * Returns { type, electionId } so the client can redirect appropriately.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return Errors.badRequest('token is required');
  }

  try {
    const result = await applyBypassToken(auth.user.sub, token);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BypassTokenError) {
      const statusMap: Record<number, () => NextResponse> = {
        400: () => Errors.badRequest(err.message),
        404: () => Errors.notFound(err.message),
        409: () => Errors.conflict(err.message),
      };
      return statusMap[err.statusCode]?.() ?? Errors.internal(err.message);
    }
    console.error('[bypass/apply]', err);
    return Errors.internal('Failed to apply bypass token');
  }
}

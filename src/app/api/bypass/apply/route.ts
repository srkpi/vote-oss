import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { applyBypassToken, BypassTokenError } from '@/lib/bypass';
import { Errors } from '@/lib/errors';

/**
 * @swagger
 * /api/bypass/apply:
 *   post:
 *     summary: Apply a bypass token
 *     description: >
 *       Validates and activates a raw bypass token for the authenticated user.
 *       The system checks for a Global token first, then an Election-specific token.
 *       This operation is idempotent; applying the same token twice will not
 *       increment usage counts further.
 *     tags:
 *       - Bypass
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: The raw base64 bypass token provided to the user.
 *     responses:
 *       200:
 *         description: Token successfully applied or already active.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [GLOBAL, ELECTION]
 *                   description: The scope of the bypass granted.
 *                 electionId:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *                   description: The ID of the election if the type is `ELECTION`; otherwise null.
 *       400:
 *         description: >
 *           Bad Request. Possible reasons:
 *           - Token has expired.
 *           - Usage limit reached.
 *           - Access has been revoked.
 *           - Election deleted or closed.
 *       401:
 *         description: Unauthorized - User session is invalid or missing.
 *       404:
 *         description: Not Found - The provided token does not exist.
 *       409:
 *         description: Conflict - State conflict preventing token application.
 *       500:
 *         description: Internal server error.
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

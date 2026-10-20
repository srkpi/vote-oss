import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { Errors } from '@/lib/errors';
import { InvalidTicketError, InvalidUserDataError, resolveTicket } from '@/lib/kpi-id';
import { completeLogin } from '@/lib/login-session';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';

/**
 * @swagger
 * /api/auth/kpi-id:
 *   post:
 *     summary: Authenticate via KPI-ID ticket
 *     description: >
 *       Exchanges a KPI-ID CAS ticket for a pair of HTTP-only JWT cookies
 *       (access + refresh). The ticket must have been issued through Diia
 *       authentication (AUTH_METHOD === "DIIA"). Non-student accounts,
 *       graduate students, and tickets issued via other auth methods are
 *       rejected. Rate-limited per IP.
 *
 *       If a `pending_bypass` cookie is present (set by the proxy when an
 *       unauthenticated user was redirected from /use/[token]), the endpoint
 *       attempts to pre-apply that bypass token before checking campus eligibility.
 *       This resolves the chicken-and-egg situation where a student needs the
 *       bypass to log in but could previously only apply tokens after login.
 *
 *       Returns a JSON body with `redirectTo` so the client does not need a
 *       separate call to /api/auth/return-to.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *             properties:
 *               ticketId:
 *                 type: string
 *                 description: CAS service ticket obtained from the KPI-ID provider
 *     responses:
 *       200:
 *         description: Authentication successful; JWT cookies set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 redirectTo:
 *                   type: string
 *                   description: Post-login redirect path
 *         headers:
 *           Set-Cookie:
 *             description: HTTP-only access and refresh token cookies
 *             schema:
 *               type: string
 *       400:
 *         description: Missing or invalid ticketId
 *       401:
 *         description: Ticket is invalid or expired
 *       403:
 *         description: Account is not a student, not authenticated through Diia, or is a graduate student
 *       429:
 *         description: Too many login attempts
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 *       500:
 *         description: Failed to contact the KPI-ID auth provider
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimitLogin(ip);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'TooManyRequests', message: 'Too many login attempts. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetInMs / 1_000)),
        },
      },
    );
  }

  let body: { ticketId?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { ticketId } = body;
  if (!ticketId || typeof ticketId !== 'string') {
    return Errors.badRequest('ticketId is required');
  }

  let kpiIdInfo;
  try {
    kpiIdInfo = await resolveTicket(ticketId);
  } catch (err) {
    if (err instanceof InvalidTicketError || err instanceof InvalidUserDataError) {
      return Errors.unauthorized(err.message);
    }
    return Errors.forbidden((err as Error).message);
  }

  return completeLogin(req, kpiIdInfo);
}

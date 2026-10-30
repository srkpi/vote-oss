import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { Errors } from '@/lib/errors';
import { InvalidTicketError, InvalidUserDataError, resolveTicket } from '@/lib/kpi-id';
import { completeLogin } from '@/lib/login-session';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';

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

import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  await prisma.jwtToken.deleteMany({
    where: { access_jti: auth.user.jti },
  });

  const response = NextResponse.json({ ok: true }, { status: 200 });

  const clearCookie = (name: string) =>
    response.cookies.set(name, '', { httpOnly: true, maxAge: 0, path: '/' });

  clearCookie(COOKIE_ACCESS);
  clearCookie(COOKIE_REFRESH);

  return response;
}

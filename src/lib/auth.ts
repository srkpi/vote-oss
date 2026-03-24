import type { NextRequest } from 'next/server';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { verifyAccessToken, verifyRefreshToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { isAccessTokenValid, isRefreshTokenValid } from '@/lib/token-store';
import type { AuthAdminSuccess, AuthFailure, AuthSuccess, VerifiedPayload } from '@/types/auth';

export async function requireAuth(req: NextRequest): Promise<AuthFailure | AuthSuccess> {
  const token = req.cookies.get(COOKIE_ACCESS)?.value;
  if (!token) {
    return { ok: false, error: 'Missing access token', status: 401 };
  }

  let payload: VerifiedPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return { ok: false, error: 'Invalid access token', status: 401 };
  }

  const valid = await isAccessTokenValid(payload.jti, payload.iat);
  if (!valid) {
    return { ok: false, error: 'Token revoked', status: 401 };
  }

  return { ok: true, user: payload };
}

export async function requireRefreshAuth(req: NextRequest): Promise<AuthFailure | AuthSuccess> {
  const token = req.cookies.get(COOKIE_REFRESH)?.value;
  if (!token) {
    return { ok: false, error: 'Missing refresh token', status: 401 };
  }

  let payload: VerifiedPayload;
  try {
    payload = await verifyRefreshToken(token);
  } catch {
    return { ok: false, error: 'Invalid refresh token', status: 401 };
  }

  const valid = await isRefreshTokenValid(payload.jti, payload.iat);
  if (!valid) {
    return { ok: false, error: 'Token revoked', status: 401 };
  }

  return { ok: true, user: payload };
}

export async function requireAdmin(req: NextRequest): Promise<AuthFailure | AuthAdminSuccess> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;

  const { user } = auth;

  if (!user.isAdmin) {
    return { ok: false, error: 'Admin access required', status: 403 };
  }

  const admin = await prisma.admin.findUnique({ where: { user_id: user.sub } });
  if (!admin || admin.deleted_at !== null) {
    return { ok: false, error: 'Admin record not found', status: 403 };
  }

  return { ok: true, user, admin };
}

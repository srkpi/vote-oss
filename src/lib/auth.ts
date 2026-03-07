import { NextRequest } from 'next/server';
import {
  verifyAccessToken,
  verifyRefreshToken,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  type JwtUserPayload,
} from './jwt';
import { prisma } from './prisma';

export type AuthResult =
  | { ok: true; user: JwtUserPayload & { jti: string } }
  | { ok: false; error: string; status: number };

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = req.cookies.get(COOKIE_ACCESS)?.value;
  if (!token) return { ok: false, error: 'Missing access token', status: 401 };

  let payload: JwtUserPayload & { jti: string };
  try {
    const p = await verifyAccessToken(token);
    payload = { ...p, sub: p.sub!, jti: p.jti! };
  } catch {
    return { ok: false, error: 'Invalid or expired access token', status: 401 };
  }

  // Check if token is revoked (not present in jwt_tokens means revoked / logged out)
  const stored = await prisma.jwtToken.findFirst({
    where: { access_jti: payload.jti },
  });
  if (!stored) return { ok: false, error: 'Token has been revoked', status: 401 };

  return { ok: true, user: payload as JwtUserPayload & { jti: string } };
}

export async function requireRefreshAuth(req: NextRequest): Promise<AuthResult> {
  const token = req.cookies.get(COOKIE_REFRESH)?.value;
  if (!token) return { ok: false, error: 'Missing refresh token', status: 401 };

  let payload: JwtUserPayload & { jti: string };
  try {
    const p = await verifyRefreshToken(token);
    payload = { ...p, sub: p.sub!, jti: p.jti! };
  } catch {
    return { ok: false, error: 'Invalid or expired refresh token', status: 401 };
  }

  const stored = await prisma.jwtToken.findFirst({
    where: { refresh_jti: payload.jti },
  });
  if (!stored) return { ok: false, error: 'Token has been revoked', status: 401 };

  return { ok: true, user: payload as JwtUserPayload & { jti: string } };
}

export async function requireAdmin(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth; // preserves status: 401

  if (!auth.user.is_admin) {
    return { ok: false as const, error: 'Admin access required', status: 403 };
  }

  const admin = await prisma.admin.findUnique({ where: { user_id: auth.user.sub } });
  if (!admin) return { ok: false as const, error: 'Admin record not found', status: 403 };

  return { ok: true as const, user: auth.user, admin };
}

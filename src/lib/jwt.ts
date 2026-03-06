import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'crypto';

export type JwtUserPayload = {
  sub: string; // userId
  faculty: string;
  group: string;
  full_name: string;
  is_admin: boolean;
  jti: string;
  token_type: 'access' | 'refresh';
};

type JosePayload = JWTPayload & JwtUserPayload;

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return new TextEncoder().encode(secret);
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: Omit<JwtUserPayload, 'jti' | 'token_type'>,
): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const token = await new SignJWT({ ...payload, token_type: 'access' } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getAccessSecret());
  return { token, jti };
}

export async function signRefreshToken(
  payload: Omit<JwtUserPayload, 'jti' | 'token_type'>,
): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const token = await new SignJWT({ ...payload, token_type: 'refresh' } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(getRefreshSecret());
  return { token, jti };
}

export async function verifyAccessToken(token: string): Promise<JosePayload> {
  const { payload } = await jwtVerify<JosePayload>(token, getAccessSecret());
  if (payload.token_type !== 'access') throw new Error('Invalid token type');
  return payload;
}

export async function verifyRefreshToken(token: string): Promise<JosePayload> {
  const { payload } = await jwtVerify<JosePayload>(token, getRefreshSecret());
  if (payload.token_type !== 'refresh') throw new Error('Invalid token type');
  return payload;
}

export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';

export function tokenCookieOptions(type: 'access' | 'refresh') {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: type === 'access' ? 60 * 15 : 60 * 60 * 24 * 7,
  };
}

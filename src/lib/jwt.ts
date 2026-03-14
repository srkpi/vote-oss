import { randomUUID } from 'crypto';
import { jwtVerify, SignJWT } from 'jose';

import { ACCESS_TOKEN_TTL_SECS, REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';

export interface TokenPayload {
  sub: string;
  faculty: string;
  group: string;
  full_name: string;
  is_admin?: boolean;
  restricted_to_faculty?: boolean;
  manage_admins?: boolean;
}

export interface VerifiedPayload extends TokenPayload {
  jti: string;
  iat: number;
  token_type: 'access' | 'refresh';
}

function getSecret(envVar: string): Uint8Array {
  const secret = process.env[envVar];
  if (!secret) throw new Error(`${envVar} is not set`);
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: TokenPayload,
): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const secret = getSecret('JWT_ACCESS_SECRET');
  const expirationTime = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECS;
  const token = await new SignJWT({ ...payload, token_type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);
  return { token, jti };
}

export async function signRefreshToken(
  payload: TokenPayload,
): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const secret = getSecret('JWT_REFRESH_SECRET');
  const expirationTime = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECS;
  const token = await new SignJWT({ ...payload, token_type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);
  return { token, jti };
}

export async function verifyAccessToken(token: string): Promise<VerifiedPayload> {
  const secret = getSecret('JWT_ACCESS_SECRET');
  const { payload } = await jwtVerify(token, secret);

  if (payload['token_type'] !== 'access') {
    throw new Error('Invalid token type');
  }

  return {
    sub: payload.sub as string,
    faculty: payload['faculty'] as string,
    group: payload['group'] as string,
    full_name: payload['full_name'] as string,
    is_admin: (payload['is_admin'] as boolean) ?? false,
    restricted_to_faculty: (payload['restricted_to_faculty'] as boolean) ?? true,
    manage_admins: (payload['manage_admins'] as boolean) ?? false,
    jti: payload.jti as string,
    iat: payload.iat as number,
    token_type: 'access',
  };
}

export async function verifyRefreshToken(token: string): Promise<VerifiedPayload> {
  const secret = getSecret('JWT_REFRESH_SECRET');
  const { payload } = await jwtVerify(token, secret);

  if (payload['token_type'] !== 'refresh') throw new Error('Invalid token type');

  return {
    sub: payload.sub as string,
    faculty: payload['faculty'] as string,
    group: payload['group'] as string,
    full_name: payload['full_name'] as string,
    is_admin: (payload['is_admin'] as boolean) ?? false,
    restricted_to_faculty: (payload['restricted_to_faculty'] as boolean) ?? true,
    manage_admins: (payload['manage_admins'] as boolean) ?? false,
    jti: payload.jti as string,
    iat: payload.iat as number,
    token_type: 'refresh',
  };
}

export function tokenCookieOptions(type: 'access' | 'refresh') {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: type === 'access' ? ACCESS_TOKEN_TTL_SECS : REFRESH_TOKEN_TTL_SECS,
    path: '/',
  };
}

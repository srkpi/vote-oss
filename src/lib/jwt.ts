import { randomUUID } from 'crypto';
import { jwtVerify, SignJWT } from 'jose';

import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NODE_ENV } from '@/lib/config/server';
import { ACCESS_TOKEN_TTL_SECS, REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';
import type { TokenPayload, VerifiedPayload } from '@/types/auth';

const ACCESS_SECRET_ENCODED = new TextEncoder().encode(JWT_ACCESS_SECRET);
const REFRESH_SECRET_ENCODED = new TextEncoder().encode(JWT_REFRESH_SECRET);

export async function signAccessToken(
  payload: TokenPayload,
): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const expirationTime = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECS;
  const token = await new SignJWT({ ...payload, tokenType: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(ACCESS_SECRET_ENCODED);
  return { token, jti };
}

export async function signRefreshToken(
  payload: TokenPayload,
): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const expirationTime = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECS;
  const token = await new SignJWT({ ...payload, tokenType: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(REFRESH_SECRET_ENCODED);
  return { token, jti };
}

export async function verifyAccessToken(token: string): Promise<VerifiedPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET_ENCODED);
  if (payload['tokenType'] !== 'access') throw new Error('Invalid token type');

  return {
    sub: payload.sub as string,
    faculty: payload['faculty'] as string,
    group: payload['group'] as string,
    fullName: payload['fullName'] as string,
    speciality: payload['speciality'] as string | undefined,
    studyYear: payload['studyYear'] as number | undefined,
    studyForm: payload['studyForm'] as string | undefined,
    isAdmin: (payload['isAdmin'] as boolean) ?? false,
    restrictedToFaculty: (payload['restrictedToFaculty'] as boolean) ?? true,
    manageAdmins: (payload['manageAdmins'] as boolean) ?? false,
    initialAuthAt: payload['initialAuthAt'] as number | undefined,
    jti: payload.jti as string,
    iat: payload.iat as number,
    tokenType: 'access',
  };
}

export async function verifyRefreshToken(token: string): Promise<VerifiedPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET_ENCODED);
  if (payload['tokenType'] !== 'refresh') throw new Error('Invalid token type');

  return {
    sub: payload.sub as string,
    faculty: payload['faculty'] as string,
    group: payload['group'] as string,
    fullName: payload['fullName'] as string,
    speciality: payload['speciality'] as string | undefined,
    studyYear: payload['studyYear'] as number | undefined,
    studyForm: payload['studyForm'] as string | undefined,
    isAdmin: (payload['isAdmin'] as boolean) ?? false,
    restrictedToFaculty: (payload['restrictedToFaculty'] as boolean) ?? true,
    manageAdmins: (payload['manageAdmins'] as boolean) ?? false,
    initialAuthAt: payload['initialAuthAt'] as number | undefined,
    jti: payload.jti as string,
    iat: payload.iat as number,
    tokenType: 'refresh',
  };
}

export function tokenCookieOptions(type: 'access' | 'refresh') {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: NODE_ENV === 'production',
    maxAge: type === 'access' ? ACCESS_TOKEN_TTL_SECS : REFRESH_TOKEN_TTL_SECS,
    path: '/',
  };
}

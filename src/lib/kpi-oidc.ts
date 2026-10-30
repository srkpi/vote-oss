import { createHash } from 'node:crypto';

import { EncryptJWT, jwtDecrypt } from 'jose';
import * as oidc from 'openid-client';

import { APP_URL, KPI_APP_ID, KPI_AUTH_URL } from '@/lib/config/client';
import { JWT_ACCESS_SECRET, KPI_APP_SECRET } from '@/lib/config/server';
import { ALLOWED_AUTH_METHODS } from '@/lib/constants';
import { InvalidUserDataError, NotAllowedAuthMethodError, NotStudentError } from '@/lib/kpi-id';
import type { KpiIdUserInfo } from '@/types/auth';

export const OIDC_COOKIE = 'kpi_oidc';
// The code expires five minutes after issuance, but identification can take longer.
export const OIDC_TTL = 15 * 60;
export const OIDC_CALLBACK = new URL('/api/auth/kpi-id/callback', APP_URL).href;
export const oidcCookieOptions = {
  httpOnly: true,
  secure: new URL(APP_URL).protocol === 'https:',
  sameSite: 'lax' as const,
  path: '/api/auth/kpi-id/callback',
  maxAge: OIDC_TTL,
};

interface OidcTransaction {
  verifier: string;
  state: string;
  nonce: string;
}

const TRANSACTION_TYPE = 'kpi-oidc+jwt';
const transactionKey = createHash('sha256')
  .update('voteoss:kpi-oidc:')
  .update(JWT_ACCESS_SECRET)
  .digest();

export function sealOidcTransaction(transaction: OidcTransaction): Promise<string> {
  return new EncryptJWT({ ...transaction })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: TRANSACTION_TYPE })
    .setIssuer(APP_URL)
    .setAudience(OIDC_CALLBACK)
    .setIssuedAt()
    .setExpirationTime(`${OIDC_TTL}s`)
    .encrypt(transactionKey);
}

export async function openOidcTransaction(cookie: string | undefined): Promise<OidcTransaction> {
  if (!cookie) {
    throw new Error('Missing login transaction');
  }
  const { payload } = await jwtDecrypt(cookie, transactionKey, {
    issuer: APP_URL,
    audience: OIDC_CALLBACK,
    typ: TRANSACTION_TYPE,
    keyManagementAlgorithms: ['dir'],
    contentEncryptionAlgorithms: ['A256GCM'],
    requiredClaims: ['iat', 'exp'],
    maxTokenAge: OIDC_TTL,
  });
  const { verifier, state, nonce } = payload;
  if (
    typeof verifier !== 'string' ||
    !verifier ||
    typeof state !== 'string' ||
    !state ||
    typeof nonce !== 'string' ||
    !nonce
  ) {
    throw new Error('Invalid login transaction');
  }
  return { verifier, state, nonce };
}

let config: Promise<oidc.Configuration> | undefined;
export function getOidcConfig() {
  return (config ??= oidc
    .discovery(new URL(KPI_AUTH_URL), KPI_APP_ID, KPI_APP_SECRET)
    .then((value) => {
      oidc.enableNonRepudiationChecks(value);
      return value;
    })
    .catch((error) => {
      config = undefined;
      throw error;
    }));
}

export function parseStudentClaims(claims: Record<string, unknown>): {
  subject: string;
  students: KpiIdUserInfo[];
} {
  if (claims.trusted !== true || !ALLOWED_AUTH_METHODS.includes(String(claims.auth_method))) {
    throw new NotAllowedAuthMethodError();
  }
  if (
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    typeof claims.name !== 'string' ||
    !claims.name.trim()
  ) {
    throw new InvalidUserDataError();
  }
  if (!Array.isArray(claims.student_ids) || claims.student_ids.length === 0) {
    throw new NotStudentError();
  }
  if (!claims.student_ids.every((id) => typeof id === 'string' && id.trim())) {
    throw new InvalidUserDataError();
  }
  return {
    subject: claims.sub,
    students: [...new Set(claims.student_ids as string[])].sort().map((id) => ({
      STUDENT_ID: id,
      NAME: claims.name as string,
      AUTH_METHOD: claims.auth_method as string,
      EMPLOYEE_ID: '',
      TAX_ID: '',
      TRACE_ID: '',
      TIME_STAMP: '',
    })),
  };
}

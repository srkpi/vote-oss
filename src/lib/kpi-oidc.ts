import * as oidc from 'openid-client';

import { APP_URL, KPI_APP_ID, KPI_AUTH_URL } from '@/lib/config/client';
import { KPI_APP_SECRET } from '@/lib/config/server';
import { ALLOWED_AUTH_METHODS } from '@/lib/constants';
import { InvalidUserDataError, NotAllowedAuthMethodError, NotStudentError } from '@/lib/kpi-id';
import type { KpiIdUserInfo } from '@/types/auth';

export const OIDC_COOKIE = 'kpi_oidc';
export const OIDC_TTL = 300;
export const OIDC_CALLBACK = new URL('/api/auth/kpi-id/callback', APP_URL).href;
export const oidcCookieOptions = {
  httpOnly: true,
  secure: new URL(APP_URL).protocol === 'https:',
  sameSite: 'lax' as const,
  path: '/api/auth/kpi-id',
  maxAge: OIDC_TTL,
};

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
  if (!Array.isArray(claims.student_ids) || claims.student_ids.length === 0)
    throw new NotStudentError();
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

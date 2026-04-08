import type { NextResponse } from 'next/server';

import { getUserBypassInfo } from '@/lib/bypass';
import { fetchFacultyGroups } from '@/lib/campus-api';
import { KPI_APP_ID, KPI_AUTH_URL } from '@/lib/config/client';
import { CAMPUS_API_URL, CAMPUS_INTEGRATION_API_KEY, KPI_APP_SECRET } from '@/lib/config/server';
import { Errors } from '@/lib/errors';
import { parseGroupLevel } from '@/lib/utils/group-utils';
import type { ApiError } from '@/types/api';
import type { CampusUserInfo, KpiIdUserInfo, UserInfo } from '@/types/auth';

export class ResolveUserDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTicketError extends ResolveUserDataError {
  constructor(message = 'Invalid or expired ticketId') {
    super(message);
  }
}

export class InvalidUserDataError extends ResolveUserDataError {
  constructor(message = 'Invalid user data retrieved from KPI ID') {
    super(message);
  }
}

export class NotStudentError extends ResolveUserDataError {
  constructor(message = 'Platform is only available for students') {
    super(message);
  }
}

export class NotDiiaAuthError extends ResolveUserDataError {
  constructor(message = 'Authentication must be performed through Diia') {
    super(message);
  }
}

export class GraduateUserError extends ResolveUserDataError {
  constructor(message = 'Platform is not available for graduate students') {
    super(message);
  }
}

export class NotStudyingError extends ResolveUserDataError {
  constructor(message = 'Platform is only available for active students') {
    super(message);
  }
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Converts a full faculty name to its abbreviation by taking the first
 * character of each word (words are separated by spaces or dashes).
 *
 * e.g. "Навчально-науковий інститут прикладної математики"
 *   → "ННіпм"  (first char of each dash/space-separated token)
 */
function abbreviateFaculty(fullName: string): string {
  return fullName
    .split(/[\s\-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Normalises an abbreviation for comparison purposes:
 * replaces the prefix "НН " with "ННІ".
 */
function normaliseAbbreviation(abbr: string): string {
  return abbr.replace(/^НН\s/, 'ННІ');
}

/**
 * Given a full faculty name and a list of `{ faculty, groups }` entries
 * returned by `fetchFacultyGroups`, resolves the short faculty identifier
 * for the student's group.
 *
 * Algorithm:
 *  1. Collect all entries whose group list contains `group`.
 *  2. If exactly one match → return its `shortFaculty` directly.
 *  3. If multiple matches → build an abbreviation from `fullFaculty` and
 *     pick the candidate whose own abbreviation has the smallest Levenshtein
 *     distance to it (after the "НН → ННІ" normalisation).
 */
export function resolveFacultyShortName(
  fullFaculty: string,
  group: string,
  facultyGroups: Record<string, string[]>,
): string {
  const matches = Object.keys(facultyGroups).filter((short) =>
    facultyGroups[short].includes(group),
  );

  if (matches.length === 0) throw new InvalidUserDataError();
  if (matches.length === 1) return matches[0];

  const targetAbbr = normaliseAbbreviation(abbreviateFaculty(fullFaculty));

  return matches.reduce((best, candidate) => {
    const bestDist = levenshtein(targetAbbr, normaliseAbbreviation(best));
    const candidateDist = levenshtein(targetAbbr, normaliseAbbreviation(candidate));
    return candidateDist < bestDist ? candidate : best;
  });
}

export async function resolveTicket(ticketId: string): Promise<KpiIdUserInfo> {
  if (!ticketId) throw new InvalidTicketError();

  const url = new URL(`${KPI_AUTH_URL}/api/ticket`);
  url.searchParams.set('ticketId', ticketId);
  url.searchParams.set('appId', KPI_APP_ID);
  url.searchParams.set('appSecret', KPI_APP_SECRET);

  const res = await fetch(url.toString());
  if (!res.ok) throw new InvalidTicketError();

  const body = (await res.json()) as { data?: KpiIdUserInfo };
  const data = body.data;

  if (!data) throw new InvalidTicketError();
  if (!data.STUDENT_ID && !data.EMPLOYEE_ID) throw new InvalidUserDataError();
  if (data.AUTH_METHOD !== 'DIIA') throw new NotDiiaAuthError();
  if (!data.STUDENT_ID && data.EMPLOYEE_ID) throw new NotStudentError();
  if (!data.STUDENT_ID || !data.NAME) throw new InvalidUserDataError();

  return data;
}

export async function resolveUserData(
  data: KpiIdUserInfo,
): Promise<{ data?: UserInfo; errors: ResolveUserDataError[] }> {
  const res = await fetch(`${CAMPUS_API_URL}/api/integration/voteoss/students/${data.STUDENT_ID}`, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': CAMPUS_INTEGRATION_API_KEY,
    },
  });
  if (!res.ok) {
    return { errors: [new InvalidUserDataError()] };
  }

  const campusData = (await res.json()) as CampusUserInfo | undefined;
  if (!campusData) {
    return { errors: [new InvalidUserDataError()] };
  }

  const errors = [];
  if (campusData.status !== 'Studying') {
    errors.push(new NotStudyingError());
  }

  const group = campusData.groupName;
  if (parseGroupLevel(group) === 'g') {
    errors.push(new GraduateUserError());
  }

  const fullFaculty = campusData.faculty;
  const facultyGroups = await fetchFacultyGroups();
  const faculty = resolveFacultyShortName(fullFaculty, group, facultyGroups);

  return {
    data: {
      userId: data.STUDENT_ID,
      fullName: data.NAME,
      faculty,
      group,
      speciality: campusData.speciality,
      studyYear: campusData.studyYear,
      studyForm: campusData.studyForm,
    },
    errors,
  };
}

export async function getCampusUserData(
  kpiIdInfo: KpiIdUserInfo,
): Promise<NextResponse<ApiError> | UserInfo> {
  const { data: userInfo, errors } = await resolveUserData(kpiIdInfo);

  if (errors.length) {
    const hasInvalidTicketOrUserData = errors.some(
      (err) => err instanceof InvalidTicketError || err instanceof InvalidUserDataError,
    );

    if (hasInvalidTicketOrUserData) {
      const err = errors.find(
        (e) => e instanceof InvalidTicketError || e instanceof InvalidUserDataError,
      )!;
      return Errors.unauthorized(err.message);
    }

    const bypassInfo = await getUserBypassInfo(kpiIdInfo.STUDENT_ID);

    const notStudyingError = errors.find((err) => err instanceof NotStudyingError);
    if (notStudyingError && !bypassInfo.global?.bypassNotStudying) {
      return Errors.forbidden(notStudyingError.message);
    }

    const graduateError = errors.find((err) => err instanceof GraduateUserError);
    if (graduateError && !bypassInfo.global?.bypassGraduate) {
      return Errors.forbidden(graduateError.message);
    }

    if (userInfo) return userInfo;

    console.error('[auth/shared] resolveTicket errors:', errors);
    return Errors.internal('Failed to contact auth provider');
  }

  if (!userInfo) return Errors.internal('Failed to resolve user info');

  return userInfo;
}

import type { NextResponse } from 'next/server';

import { getUserBypassInfo } from '@/lib/bypass';
import { fetchFacultyGroups } from '@/lib/campus-api';
import { KPI_APP_ID, KPI_AUTH_URL } from '@/lib/config/client';
import { CAMPUS_API_URL, CAMPUS_INTEGRATION_API_KEY, KPI_APP_SECRET } from '@/lib/config/server';
import { ALLOWED_AUTH_METHODS } from '@/lib/constants';
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

export class NotAllowedAuthMethodError extends ResolveUserDataError {
  constructor(message = 'Not allowed auth method') {
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
 * Only used as a last-resort fallback when no candidate short name can be
 * spelled out of the full name (see `resolveFacultyShortName`).
 *
 * e.g. "Навчально-науковий інститут прикладної математики"
 *   → "ННІПМ"  (first char of each dash/space-separated token)
 */
function abbreviateFaculty(fullName: string): string {
  return fullName
    .split(/[\s\-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Latin letters that look like Cyrillic ones -> their Cyrillic counterparts. */
const LATIN_TO_CYR: Record<string, string> = {
  a: 'а',
  b: 'в',
  c: 'с',
  e: 'е',
  h: 'н',
  i: 'і',
  k: 'к',
  m: 'м',
  o: 'о',
  p: 'р',
  t: 'т',
  x: 'х',
  y: 'у',
};

/** Conjunctions / prepositions that never contribute a letter to a short name. */
const STOP_WORDS = new Set(['та', 'і', 'й', 'з', 'для', 'у', 'в', 'на']);

const INSIDE_WORD_COST = 1;
const SKIPPED_WORD_COST = 2;

/** Lowercases and replaces Latin lookalikes with Cyrillic letters. */
const fold = (s: string): string =>
  [...s.toLowerCase()].map((ch) => LATIN_TO_CYR[ch] ?? ch).join('');

/** Keeps only (folded) Cyrillic letters and digits. */
const letters = (s: string): string => fold(s).replace(/[^а-яіїєґ0-9]/g, '');

/**
 * Splits a full faculty/institute name into comparable words:
 * drops the "ім. ..." suffix, splits on hyphens/apostrophes/spaces and
 * removes stop words.
 */
function nameWords(fullName: string): string[] {
  return fold(fullName)
    .replace(/\s+ім\..*$/, '')
    .split(/[^а-яіїєґ]+/)
    .filter((w) => w && !STOP_WORDS.has(w));
}

/**
 * Short-name keys may contain aliases in parentheses, e.g. "ФАПІЕ (ІХФ)".
 * "НН ІАТ" -> ["нніат"], "ФАПІЕ (ІХФ)" -> ["фапіе", "іхф"].
 */
const aliases = (key: string): string[] => key.split(/[()]/).map(letters).filter(Boolean);

/**
 * Cost of spelling `alias` as an ordered subsequence of the letters of `words`.
 *  - a letter at the start of a word is free;
 *  - a letter inside a word costs INSIDE_WORD_COST;
 *  - every word skipped between/after used letters costs SKIPPED_WORD_COST.
 * Returns Infinity when the alias cannot be spelled out of the words at all.
 */
function matchCost(alias: string, words: string[]): number {
  const memo = new Map<string, number>();

  const go = (i: number, last: number, from: number): number => {
    if (i === alias.length) return SKIPPED_WORD_COST * (words.length - 1 - last);

    const memoKey = `${i}:${last}:${from}`;
    const cached = memo.get(memoKey);
    if (cached !== undefined) return cached;

    let best = Infinity;
    for (let w = Math.max(last, 0); w < words.length; w++) {
      for (let c = w === last ? from : 0; c < words[w].length; c++) {
        if (words[w][c] !== alias[i]) continue;
        const skipped = w === last ? 0 : w - last - 1;
        const cost =
          (c === 0 ? 0 : INSIDE_WORD_COST) + SKIPPED_WORD_COST * skipped + go(i + 1, w, c + 1);
        best = Math.min(best, cost);
      }
    }

    memo.set(memoKey, best);
    return best;
  };

  return go(0, -1, 0);
}

/**
 * Given a full faculty name, the student's group and a map of
 * `shortFaculty -> groups` returned by `fetchFacultyGroups`, resolves the
 * short faculty identifier for the student's group.
 *
 * Algorithm:
 *  1. Collect all entries whose group list contains `group`
 *     (comparison ignores case, dashes and Latin/Cyrillic lookalikes).
 *  2. If exactly one match → return it directly.
 *  3. Otherwise score every candidate (the matches, or all entries if there
 *     were none) by how cheaply its short name (and any alias in parentheses)
 *     can be spelled out of the full name, in order. Lowest cost wins; ties
 *     are broken alphabetically so the result does not depend on key order.
 *  4. If no candidate can be spelled out of the full name, fall back to
 *     Levenshtein distance against the first-letter abbreviation.
 *
 * No hardcoded list of faculties is needed: a new or renamed faculty works as
 * long as its short name is derived from its full name.
 */
export function resolveFacultyShortName(
  fullFaculty: string,
  group: string,
  facultyGroups: Record<string, string[]>,
): string {
  const normGroup = letters(group);
  const matches = Object.keys(facultyGroups).filter((short) =>
    facultyGroups[short].some((g) => letters(g) === normGroup),
  );

  if (matches.length === 1) return matches[0];

  const candidates = matches.length > 0 ? matches : Object.keys(facultyGroups);
  if (candidates.length === 0) throw new InvalidUserDataError();

  const words = nameWords(fullFaculty);
  const scored = candidates
    .map((key) => ({
      key,
      cost: Math.min(...aliases(key).map((a) => matchCost(a, words))),
    }))
    .sort((a, b) => a.cost - b.cost || a.key.localeCompare(b.key));

  if (Number.isFinite(scored[0].cost)) return scored[0].key;

  // Nothing can be spelled out of the full name: fall back to Levenshtein.
  const target = letters(abbreviateFaculty(fullFaculty));
  return candidates.reduce((best, candidate) =>
    levenshtein(target, letters(candidate)) < levenshtein(target, letters(best)) ? candidate : best,
  );
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
  if (!ALLOWED_AUTH_METHODS.includes(data.AUTH_METHOD)) {
    throw new NotAllowedAuthMethodError();
  }
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
  if (campusData.status !== 'Studying' && campusData.status !== 'OnAcademicLeave') {
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

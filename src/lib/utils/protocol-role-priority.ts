/**
 * Role-importance ranking for protocol "posada" (position/title) values.
 *
 * Powers the "smart" quick-sort option for the Responsibles and Attendance
 * lists on a protocol: most important roles first, then alphabetically by
 * full name within the same role.
 *
 * Importance order (most → least important):
 *   0. Президент
 *   1. Заступник президента
 *   2. Виконуючий обов'язки президента / в.о. президента
 *   3. Голова
 *   4. Виконуючий обов'язки голови / в. о. голови
 *   5. Секретар
 *   6. Заступник голови
 *   7. Член
 *   8. everything else
 *
 * Matching is case-insensitive and allows partial matches (e.g. "Голова
 * Студради" or "Член комісії" are recognised), and the "в.о." abbreviation is
 * recognised however it's punctuated/spaced — "в.о. голови", "в. о. голови",
 * and "во голови" all count.
 */

/** One past the last named role — used for anything that doesn't match. */
export const ROLE_PRIORITY_OTHER = 8;

function normalize(posada: string): string {
  // Strip apostrophes (straight and curly) so "обов'язки" / "обов’язки" /
  // "обовязки" all normalize to the same stem.
  return posada.toLowerCase().replace(/['’ʼ`]/g, '');
}

/** True when `normalized` contains a "заступник"/"заступниця" (deputy) marker together with `role`. */
function isDeputy(normalized: string, role: string): boolean {
  return (
    (normalized.includes('заступник') || normalized.includes('заступниц')) &&
    normalized.includes(role)
  );
}

/**
 * True when `normalized` contains an "acting" marker for `role`: either the
 * spelled-out "виконуючий обов'язки <role>" (stems, so declensions match), or
 * the "в.о." abbreviation immediately before `role`, however it's punctuated
 * or spaced ("в.о.", "в. о.", "во", "в о").
 */
function isActing(normalized: string, role: string): boolean {
  const spelledOut =
    normalized.includes('виконуюч') && normalized.includes('обов') && normalized.includes(role);
  const abbreviation = new RegExp(`в\\.?\\s*о\\.?\\s*${role}`).test(normalized);
  return spelledOut || abbreviation;
}

/**
 * Returns the importance rank (0 = most important, `ROLE_PRIORITY_OTHER` =
 * unrecognised) for a protocol posada string.
 */
export function getRolePriority(posadaRaw: string): number {
  const s = normalize(posadaRaw).trim();
  if (!s) return ROLE_PRIORITY_OTHER;

  // President family — check the more specific "заступник"/"в.о." forms
  // before the bare word, since e.g. "президента" (genitive, as in
  // "заступник президента") also contains the substring "президент".
  if (isDeputy(s, 'президент')) return 1;
  if (isActing(s, 'президент')) return 2;
  if (s.includes('президент')) return 0;

  // Голова family — same reasoning, plus the bare check uses the exact
  // nominative word "голова" (not just the "голов" stem) so that unrelated
  // titles like "Головний бухгалтер" (Chief Accountant) don't match: their
  // 6th letter is "н", not "а", so "голова" isn't a substring of "головний".
  if (isActing(s, 'голов')) return 4;
  if (isDeputy(s, 'голов')) return 6;
  if (s.includes('голова')) return 3;

  if (s.includes('секретар')) return 5;
  if (s.includes('член')) return 7;

  return ROLE_PRIORITY_OTHER;
}

/**
 * Comparator for the "smart" sort: role importance ascending (most important
 * first), then alphabetically by full name within the same role.
 */
export function compareByRoleImportance<T extends { posada: string; fullname: string }>(
  a: T,
  b: T,
): number {
  const diff = getRolePriority(a.posada) - getRolePriority(b.posada);
  if (diff !== 0) return diff;
  return a.fullname.localeCompare(b.fullname, 'uk');
}

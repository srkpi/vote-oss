/**
 * Campus API integration.
 *
 * Fetches the full list of groups (with their faculties) from the campus API
 * and returns them keyed by faculty.  Results are cached in Redis for
 * CACHE_TTL_CAMPUS_GROUPS_SECS to avoid hammering the upstream API.
 *
 * Faculty name normalisation
 * ──────────────────────────
 * Some records in the campus API have malformed faculty names where "НН" is
 * not followed by a space, e.g. "ННІМЗ" instead of "НН ІМЗ".  The
 * `fixFacultyName` helper corrects these at ingest time so the rest of the
 * app always sees clean names.
 */

import { CAMPUS_API_URL } from '@/lib/config/server';
import { CACHE_KEY_CAMPUS_GROUPS, CACHE_TTL_CAMPUS_GROUPS_SECS } from '@/lib/constants';
import { redis, safeRedis } from '@/lib/redis';

interface RawCampusGroup {
  id: number;
  name: string;
  faculty: string;
}

/**
 * Fix malformed "НН" faculty names.
 *
 * The campus API occasionally returns faculty names like "ННІМЗ" instead of
 * the canonical "НН ІМЗ".  Any string starting with "НН" where the third
 * character is not a space gets a space inserted after "НН".
 *
 * Correctly formatted names ("НН ФТІ") are left unchanged.
 */
export function fixFacultyName(faculty: string): string {
  if (faculty.length > 2 && faculty.startsWith('НН') && faculty[2] !== ' ') {
    return 'НН ' + faculty.slice(2);
  }
  return faculty;
}

/**
 * Fetch all groups from the campus API and return them grouped by faculty.
 *
 * Keys   = faculty names (normalised via `fixFacultyName`), sorted
 * Values = group names for that faculty, sorted alphabetically
 *
 * Results are cached in Redis; on a cache miss the upstream API is queried
 * and the result is stored for CACHE_TTL_CAMPUS_GROUPS_SECS seconds.
 *
 * @throws if CAMPUS_API_URL is not set or the upstream request fails.
 */
export async function fetchFacultyGroups(): Promise<Record<string, string[]>> {
  const cached = await safeRedis(() => redis.get(CACHE_KEY_CAMPUS_GROUPS));
  if (cached) {
    try {
      return JSON.parse(cached) as Record<string, string[]>;
    } catch {
      // Corrupted cache entry – fall through to a fresh fetch
    }
  }

  const res = await fetch(`${CAMPUS_API_URL}/group/all`);
  if (!res.ok) {
    throw new Error(`Campus API responded with status ${res.status}`);
  }

  const data = (await res.json()) as RawCampusGroup[];
  const map: Record<string, string[]> = {};

  for (const { faculty: rawFaculty, name } of data) {
    const faculty = fixFacultyName(rawFaculty.trim());
    if (!map[faculty]) map[faculty] = [];
    map[faculty].push(name);
  }

  // Sort groups within each faculty alphabetically
  for (const faculty of Object.keys(map)) {
    map[faculty].sort((a, b) => a.localeCompare(b, 'uk'));
  }

  await safeRedis(() =>
    redis.set(CACHE_KEY_CAMPUS_GROUPS, JSON.stringify(map), 'EX', CACHE_TTL_CAMPUS_GROUPS_SECS),
  );

  return map;
}

/** Evict the campus groups cache (useful in tests / admin tooling). */
export async function invalidateCampusGroupsCache(): Promise<void> {
  await safeRedis(() => redis.del(CACHE_KEY_CAMPUS_GROUPS));
}

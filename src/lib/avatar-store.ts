import { api } from '@/lib/api/browser';
import {
  LOCAL_STORAGE_AVATAR_KEY_PREFIX,
  MAX_RESOLVE_AVATAR_URLS_PER_REQUEST,
} from '@/lib/constants';

/**
 * Client-side cache of resolved avatar URLs, shared by every component that
 * renders a user's avatar (header, ballots, petition signatories, admin and
 * group member lists, ...).
 *
 *   - `undefined` -> never looked up yet
 *   - `null`      -> looked up, confirmed the user has no avatar
 *   - `string`    -> resolved avatar URL
 *
 * This lives outside React on purpose: one module-level store means
 * resolving a voter's avatar on the ballots page also warms the cache for
 * their row in an admin list, and deleting an avatar anywhere
 * (`setAvatar(id, null)`) is instantly reflected everywhere else that same
 * id is rendered — no prop plumbing, no refetch.
 */

type AvatarValue = string | null;

const cache = new Map<string, AvatarValue>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeAvatars(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCachedAvatar(userId: string): AvatarValue | undefined {
  return cache.get(userId);
}

/**
 * Hydrate the cache with values we already know (e.g. a server-rendered
 * `avatarUrl` field). Never clobbers an existing entry — an explicit
 * `setAvatar` call (upload/delete) always wins over re-hydration from a
 * possibly-stale prop passed in on a later render.
 */
export function primeAvatars(entries: Iterable<readonly [string, AvatarValue]>): void {
  let changed = false;
  for (const [userId, url] of entries) {
    if (userId && !cache.has(userId)) {
      cache.set(userId, url);
      changed = true;
    }
  }
  if (changed) notify();
}

/** Authoritatively set (or clear) a single user's avatar, e.g. after upload/delete. */
export function setAvatar(userId: string, url: AvatarValue): void {
  if (cache.get(userId) === url) return;
  cache.set(userId, url);
  notify();
}

/**
 * Resolve avatars for any of the given ids that aren't cached yet. Safe to
 * call on every render/page — ids already known (or already in flight) are
 * skipped, so revisiting a page never re-fetches, and requests are chunked
 * to `MAX_RESOLVE_AVATAR_URLS_PER_REQUEST` so a big batch can never 400.
 */
export async function ensureAvatars(userIds: readonly string[]): Promise<void> {
  const missing = [...new Set(userIds)].filter((id) => !!id && !cache.has(id) && !inFlight.has(id));
  if (missing.length === 0) return;

  missing.forEach((id) => inFlight.add(id));
  try {
    for (let i = 0; i < missing.length; i += MAX_RESOLVE_AVATAR_URLS_PER_REQUEST) {
      const chunk = missing.slice(i, i + MAX_RESOLVE_AVATAR_URLS_PER_REQUEST);
      const result = await api.users.avatars(chunk);
      if (result.success) {
        for (const id of chunk) cache.set(id, result.data.avatars[id] ?? null);
      }
      // On failure we simply leave those ids unresolved so a later call can
      // retry, instead of caching a transient failure as "no avatar".
    }
  } finally {
    missing.forEach((id) => inFlight.delete(id));
    notify();
  }
}

// ---------------------------------------------------------------------------
// Persistence for the signed-in user's own avatar only — this is what lets
// the header show the right image immediately on a hard reload instead of
// flashing initials while the network request is in flight. Other users'
// avatars (ballots, admin lists, ...) are intentionally NOT persisted.
// ---------------------------------------------------------------------------

function selfKey(userId: string): string {
  return `${LOCAL_STORAGE_AVATAR_KEY_PREFIX}${userId}`;
}

export function primeSelfAvatarFromStorage(userId: string): void {
  if (typeof window === 'undefined' || cache.has(userId)) return;
  try {
    const raw = localStorage.getItem(selfKey(userId));
    if (raw !== null) {
      cache.set(userId, raw === '' ? null : raw);
      notify();
    }
  } catch {
    // localStorage may be unavailable
  }
}

function persistSelfAvatar(userId: string, url: AvatarValue): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(selfKey(userId), url ?? '');
  } catch {
    // ignore
  }
}

/** Set the signed-in user's own avatar and persist it for the next hard reload. */
export function setSelfAvatar(userId: string, url: AvatarValue): void {
  setAvatar(userId, url);
  persistSelfAvatar(userId, url);
}

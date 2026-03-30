import {
  CONFETTI_KEY_PREFIX,
  LOCAL_STORAGE_VOTE_KEY_PREFIX,
  SESSION_USER_KEY,
} from '@/lib/constants';
import type { VoteRecord } from '@/types/vote';

function key(electionId: string): string {
  return `${LOCAL_STORAGE_VOTE_KEY_PREFIX}${electionId}`;
}

export function saveVote(record: VoteRecord): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(record.electionId), JSON.stringify(record));
  } catch {
    // localStorage may be unavailable
  }
}

export function getVote(electionId: string): VoteRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(electionId));
    if (!raw) return null;
    return JSON.parse(raw) as VoteRecord;
  } catch {
    return null;
  }
}

export function clearAllVotes(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove = Object.keys(localStorage).filter(
      (k) => k.startsWith(LOCAL_STORAGE_VOTE_KEY_PREFIX) || k.startsWith(CONFETTI_KEY_PREFIX),
    );
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Session user tracking — used to detect when a different user logs in so
// that stale votes from the previous session are cleared automatically.
// ---------------------------------------------------------------------------

export function getStoredSessionUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(SESSION_USER_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_USER_KEY, userId);
  } catch {
    // ignore
  }
}

/**
 * Call this on every authenticated page load.
 * If the stored userId doesn't match the current session userId, all votes
 * (and confetti flags) are cleared and the new userId is persisted.
 * This covers both "different user on same device" and "re-login after
 * token expiry" scenarios.
 */
export function syncSessionUser(currentUserId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = getStoredSessionUserId();
    if (stored !== currentUserId) {
      if (stored !== null) {
        // A different user was here before — wipe their vote data.
        clearAllVotes();
      }
      setStoredSessionUserId(currentUserId);
    }
  } catch {
    // ignore
  }
}

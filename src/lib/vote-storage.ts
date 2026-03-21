import { LOCAL_STORAGE_VOTE_KEY_PREFIX } from '@/lib/constants';
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
    const toRemove = Object.keys(localStorage).filter((k) =>
      k.startsWith(LOCAL_STORAGE_VOTE_KEY_PREFIX),
    );
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

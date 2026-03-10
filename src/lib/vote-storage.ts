import type { VoteRecord } from '@/types';

const KEY_PREFIX = 'kpi_vote_';

function key(electionId: number): string {
  return `${KEY_PREFIX}${electionId}`;
}

export function saveVote(record: VoteRecord): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(record.electionId), JSON.stringify(record));
  } catch {
    // localStorage may be unavailable
  }
}

export function getVote(electionId: number): VoteRecord | null {
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
    const toRemove = Object.keys(localStorage).filter((k) => k.startsWith(KEY_PREFIX));
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

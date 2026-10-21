import { vi } from 'vitest';
/**
 * Mock for @/lib/cache.
 *
 * Usage:
 *   import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
 *   vi.mock('@/lib/cache', async () => {
 *     const { cacheMock } = await import('@/__tests__/helpers/cache-mock');
 *     return cacheMock;
 *   });
 *   beforeEach(() => resetCacheMock());
 *
 * Defaults: all getters return null (cache-miss), all setters/invalidators
 * resolve with undefined.
 */

import type { CachedElection } from '@/types/election';
import type { FaqCategoryData } from '@/types/faq';

export const cacheMock = {
  getCachedElections: vi.fn<(...args: []) => Promise<null>>(),
  setCachedElections: vi.fn<(...args: [CachedElection[]]) => Promise<void>>(),
  invalidateElections: vi.fn<(...args: []) => Promise<void>>(),
  getCachedAdmins: vi.fn<(...args: []) => Promise<null>>(),
  setCachedAdmins: vi.fn<(...args: [unknown[]]) => Promise<void>>(),
  invalidateAdmins: vi.fn<(...args: []) => Promise<void>>(),
  getCachedInviteTokens: vi.fn<(...args: []) => Promise<null>>(),
  setCachedInviteTokens: vi.fn<(...args: [unknown[]]) => Promise<void>>(),
  invalidateInviteTokens: vi.fn<(...args: []) => Promise<void>>(),
  getCachedFaq: vi.fn<(...args: []) => Promise<null>>(),
  setCachedFaq: vi.fn<(...args: [FaqCategoryData[]]) => Promise<void>>(),
  invalidateFaq: vi.fn<(...args: []) => Promise<void>>(),
  addToUserVotedElections: vi.fn<(...args: [string, string]) => Promise<void>>(),
  overlayLiveBallotCounts: vi.fn<(...args: [CachedElection[]]) => Promise<CachedElection[]>>(),
  getCachedUserVotedElections: vi.fn<(...args: [string]) => Promise<Set<string> | null>>(),
  setCachedUserVotedElections: vi.fn<(...args: [string, string[]]) => Promise<void>>(),
  invalidateUserVotedElections: vi.fn<(...args: [string]) => Promise<void>>(),
  getLiveElectionBallotCount: vi.fn<(...args: [string]) => Promise<number | null>>(),
  setLiveElectionBallotCount: vi.fn<(...args: [string, number]) => Promise<void>>(),
  incrementLiveElectionBallotCount: vi.fn<(...args: [string]) => Promise<number | null>>(),
  invalidateLiveElectionBallotCount: vi.fn<(...args: [string]) => Promise<void>>(),
};

export function resetCacheMock(): void {
  cacheMock.getCachedElections.mockReset().mockResolvedValue(null);
  cacheMock.setCachedElections.mockReset().mockResolvedValue(undefined);
  cacheMock.invalidateElections.mockReset().mockResolvedValue(undefined);
  cacheMock.getCachedAdmins.mockReset().mockResolvedValue(null);
  cacheMock.setCachedAdmins.mockReset().mockResolvedValue(undefined);
  cacheMock.invalidateAdmins.mockReset().mockResolvedValue(undefined);
  cacheMock.getCachedInviteTokens.mockReset().mockResolvedValue(null);
  cacheMock.setCachedInviteTokens.mockReset().mockResolvedValue(undefined);
  cacheMock.invalidateInviteTokens.mockReset().mockResolvedValue(undefined);
  cacheMock.getCachedFaq.mockReset().mockResolvedValue(null);
  cacheMock.setCachedFaq.mockReset().mockResolvedValue(undefined);
  cacheMock.invalidateFaq.mockReset().mockResolvedValue(undefined);
  cacheMock.addToUserVotedElections.mockReset().mockResolvedValue(undefined);
  cacheMock.overlayLiveBallotCounts.mockReset().mockImplementation(async (e) => e);
  cacheMock.getCachedUserVotedElections.mockReset().mockResolvedValue(null);
  cacheMock.setCachedUserVotedElections.mockReset().mockResolvedValue(undefined);
  cacheMock.invalidateUserVotedElections.mockReset().mockResolvedValue(undefined);
  cacheMock.getLiveElectionBallotCount.mockReset().mockResolvedValue(null);
  cacheMock.setLiveElectionBallotCount.mockReset().mockResolvedValue(undefined);
  cacheMock.incrementLiveElectionBallotCount.mockReset().mockResolvedValue(null);
  cacheMock.invalidateLiveElectionBallotCount.mockReset().mockResolvedValue(undefined);
}

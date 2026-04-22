/**
 * Mock for @/lib/cache.
 *
 * Usage:
 *   import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
 *   jest.mock('@/lib/cache', () => cacheMock);
 *   beforeEach(() => resetCacheMock());
 *
 * Defaults: all getters return null (cache-miss), all setters/invalidators
 * resolve with undefined.
 */

import type { CachedElection } from '@/types/election';
import type { FaqCategoryData } from '@/types/faq';

export const cacheMock = {
  getCachedElections: jest.fn<Promise<null>, []>(),
  setCachedElections: jest.fn<Promise<void>, [CachedElection[]]>(),
  invalidateElections: jest.fn<Promise<void>, []>(),
  getCachedAdmins: jest.fn<Promise<null>, []>(),
  setCachedAdmins: jest.fn<Promise<void>, [unknown[]]>(),
  invalidateAdmins: jest.fn<Promise<void>, []>(),
  getCachedInviteTokens: jest.fn<Promise<null>, []>(),
  setCachedInviteTokens: jest.fn<Promise<void>, [unknown[]]>(),
  invalidateInviteTokens: jest.fn<Promise<void>, []>(),
  getCachedFaq: jest.fn<Promise<null>, []>(),
  setCachedFaq: jest.fn<Promise<void>, [FaqCategoryData[]]>(),
  invalidateFaq: jest.fn<Promise<void>, []>(),
  addToUserVotedElections: jest.fn<Promise<void>, [string, string]>(),
  overlayLiveBallotCounts: jest.fn<Promise<CachedElection[]>, [CachedElection[]]>(),
  getCachedUserVotedElections: jest.fn<Promise<Set<string> | null>, [string]>(),
  setCachedUserVotedElections: jest.fn<Promise<void>, [string, string[]]>(),
  invalidateUserVotedElections: jest.fn<Promise<void>, [string]>(),
  getLiveElectionBallotCount: jest.fn<Promise<number | null>, [string]>(),
  setLiveElectionBallotCount: jest.fn<Promise<void>, [string, number]>(),
  incrementLiveElectionBallotCount: jest.fn<Promise<number | null>, [string]>(),
  invalidateLiveElectionBallotCount: jest.fn<Promise<void>, [string]>(),
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

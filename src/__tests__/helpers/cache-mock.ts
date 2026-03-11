/**
 * Mock for @/lib/cache.
 *
 * Usage:
 *   import { cacheMock, resetCacheMock } from '../../helpers/cache-mock';
 *   jest.mock('@/lib/cache', () => cacheMock);
 *   beforeEach(() => resetCacheMock());
 *
 * Defaults: all getters return null (cache-miss), all setters/invalidators
 * resolve with undefined.
 */

import type { CachedElection } from '@/lib/cache';

export const cacheMock = {
  getCachedElections: jest.fn<Promise<null>, []>(),
  setCachedElections: jest.fn<Promise<void>, [CachedElection[]]>(),
  invalidateElections: jest.fn<Promise<void>, []>(),
  getCachedAdmins: jest.fn<Promise<null>, []>(),
  setCachedAdmins: jest.fn<Promise<void>, [unknown[]]>(),
  invalidateAdmins: jest.fn<Promise<void>, []>(),
};

export function resetCacheMock(): void {
  cacheMock.getCachedElections.mockReset().mockResolvedValue(null);
  cacheMock.setCachedElections.mockReset().mockResolvedValue(undefined);
  cacheMock.invalidateElections.mockReset().mockResolvedValue(undefined);
  cacheMock.getCachedAdmins.mockReset().mockResolvedValue(null);
  cacheMock.setCachedAdmins.mockReset().mockResolvedValue(undefined);
  cacheMock.invalidateAdmins.mockReset().mockResolvedValue(undefined);
}

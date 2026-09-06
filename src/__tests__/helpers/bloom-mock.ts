/**
 * Mock for @/lib/bloom.
 *
 * Usage:
 *   import { bloomMock, resetBloomMock } from '@/__tests__/helpers/bloom-mock';
 *   jest.mock('@/lib/bloom', () => bloomMock);
 *   beforeEach(() => resetBloomMock());
 *
 * Default: bloomAdd resolves, getBloomResetAt resolves to 0 (no reset gate),
 * isTokenClean resolves to true (clean).
 */

export const bloomMock = {
  bloomAdd: jest.fn<Promise<void>, [string, number]>().mockResolvedValue(undefined),
  getBloomResetAt: jest.fn<Promise<number>, []>().mockResolvedValue(0),
  isTokenClean: jest.fn<Promise<boolean | null>, [string]>().mockResolvedValue(true),
  revokedKey: jest.fn((jti: string) => `revoked:${jti}`),
};

export function resetBloomMock(): void {
  bloomMock.bloomAdd.mockReset().mockResolvedValue(undefined);
  bloomMock.getBloomResetAt.mockReset().mockResolvedValue(0);
  bloomMock.isTokenClean.mockReset().mockResolvedValue(true);
}

import { vi } from 'vitest';

/**
 * Mock for @/lib/bloom.
 *
 * Usage:
 *   import { bloomMock, resetBloomMock } from '@/__tests__/helpers/bloom-mock';
 *   vi.mock('@/lib/bloom', async () => {
 *     const { bloomMock } = await import('@/__tests__/helpers/bloom-mock');
 *     return bloomMock;
 *   });
 *   beforeEach(() => resetBloomMock());
 *
 * Default: bloomAdd resolves, getBloomResetAt resolves to 0 (no reset gate),
 * isTokenClean resolves to true (clean).
 */

export const bloomMock = {
  bloomAdd: vi.fn<(...args: [string, number]) => Promise<void>>().mockResolvedValue(undefined),
  getBloomResetAt: vi.fn<(...args: []) => Promise<number>>().mockResolvedValue(0),
  isTokenClean: vi.fn<(...args: [string]) => Promise<boolean | null>>().mockResolvedValue(true),
  revokedKey: vi.fn((jti: string) => `revoked:${jti}`),
};

export function resetBloomMock(): void {
  bloomMock.bloomAdd.mockReset().mockResolvedValue(undefined);
  bloomMock.getBloomResetAt.mockReset().mockResolvedValue(0);
  bloomMock.isTokenClean.mockReset().mockResolvedValue(true);
}

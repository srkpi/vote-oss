import { vi } from 'vitest';

/**
 * Mock for @/lib/token-store.
 *
 * Usage in test files:
 *
 *   import { tokenStoreMock, resetTokenStoreMock } from '@/__tests__/helpers/token-store-mock';
 *   vi.mock('@/lib/token-store', async () => {
 *     const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
 *     return tokenStoreMock;
 *   });
 *
 *   beforeEach(() => resetTokenStoreMock());
 *
 * Defaults:
 *   - isAccessTokenValid  → resolves true  (token is valid)
 *   - isRefreshTokenValid → resolves true  (token is valid)
 *   - persistTokenPair    → resolves void
 *   - revokeByAccessJti   → resolves void
 *   - revokeByRefreshJti  → resolves { accessJti: 'access-jti-stub' }
 *   - revokeTokenPair     → resolves void
 */

export const tokenStoreMock = {
  ACCESS_TTL_SECS: 900,
  REFRESH_TTL_SECS: 604_800,

  persistTokenPair: vi.fn<(...args: [string, string]) => Promise<void>>(),
  isAccessTokenValid: vi.fn<(...args: [string, number]) => Promise<boolean>>(),
  isRefreshTokenValid: vi.fn<(...args: [string, number]) => Promise<boolean>>(),
  revokeByAccessJti: vi.fn<(...args: [string, number]) => Promise<void>>(),
  revokeByRefreshJti: vi.fn<(...args: [string, number]) => Promise<{ accessJti: string | null }>>(),
  revokeTokenPair: vi.fn<(...args: [string, string, number, number]) => Promise<void>>(),
};

export function resetTokenStoreMock(): void {
  tokenStoreMock.persistTokenPair.mockReset().mockResolvedValue(undefined);
  tokenStoreMock.isAccessTokenValid.mockReset().mockResolvedValue(true);
  tokenStoreMock.isRefreshTokenValid.mockReset().mockResolvedValue(true);
  tokenStoreMock.revokeByAccessJti.mockReset().mockResolvedValue(undefined);
  tokenStoreMock.revokeByRefreshJti.mockReset().mockResolvedValue({ accessJti: 'access-jti-stub' });
  tokenStoreMock.revokeTokenPair.mockReset().mockResolvedValue(undefined);
}

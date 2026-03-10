/**
 * Mock for @/lib/token-store.
 *
 * Usage in test files:
 *
 *   import { tokenStoreMock, resetTokenStoreMock } from '../../helpers/token-store-mock';
 *   jest.mock('@/lib/token-store', () => tokenStoreMock);
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
 *   - invalidateAdminCache→ resolves void
 */

export const tokenStoreMock = {
  ACCESS_TTL_SECS: 900,
  REFRESH_TTL_SECS: 604_800,

  persistTokenPair: jest.fn<Promise<void>, [string, string]>(),
  isAccessTokenValid: jest.fn<Promise<boolean>, [string, number]>(),
  isRefreshTokenValid: jest.fn<Promise<boolean>, [string, number]>(),
  revokeByAccessJti: jest.fn<Promise<void>, [string, number]>(),
  revokeByRefreshJti: jest.fn<Promise<{ accessJti: string | null }>, [string, number]>(),
  revokeTokenPair: jest.fn<Promise<void>, [string, string, number, number]>(),
  invalidateAdminCache: jest.fn<Promise<void>, []>(),
};

export function resetTokenStoreMock(): void {
  tokenStoreMock.persistTokenPair.mockReset().mockResolvedValue(undefined);
  tokenStoreMock.isAccessTokenValid.mockReset().mockResolvedValue(true);
  tokenStoreMock.isRefreshTokenValid.mockReset().mockResolvedValue(true);
  tokenStoreMock.revokeByAccessJti.mockReset().mockResolvedValue(undefined);
  tokenStoreMock.revokeByRefreshJti.mockReset().mockResolvedValue({ accessJti: 'access-jti-stub' });
  tokenStoreMock.revokeTokenPair.mockReset().mockResolvedValue(undefined);
  tokenStoreMock.invalidateAdminCache.mockReset().mockResolvedValue(undefined);
}

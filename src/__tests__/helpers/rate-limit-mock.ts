/**
 * Mock for @/lib/rate-limit.
 *
 * Usage:
 *   import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
 *   jest.mock('@/lib/rate-limit', () => rateLimitMock);
 *   beforeEach(() => resetRateLimitMock());
 *
 * Default: all limiters resolve with { limited: false }.
 * To simulate a rate-limited response, call:
 *   rateLimitMock.rateLimitLogin.mockResolvedValueOnce({ limited: true, remaining: 0, resetInMs: 50000 });
 */

const notLimited = { limited: false, remaining: 10, resetInMs: 60_000 };

export const rateLimitMock = {
  rateLimit: jest.fn().mockResolvedValue(notLimited),
  rateLimitLogin: jest.fn().mockResolvedValue(notLimited),
  rateLimitRefresh: jest.fn().mockResolvedValue(notLimited),
  rateLimitInvite: jest.fn().mockResolvedValue(notLimited),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
};

export function resetRateLimitMock(): void {
  rateLimitMock.rateLimit.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitLogin.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitRefresh.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitInvite.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.getClientIp.mockReset().mockReturnValue('127.0.0.1');
}

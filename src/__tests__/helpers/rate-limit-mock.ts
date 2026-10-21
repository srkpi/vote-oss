import { vi } from 'vitest';

/**
 * Mock for @/lib/rate-limit.
 *
 * Usage:
 *   import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
 *   vi.mock('@/lib/rate-limit', async () => {
 *     const { rateLimitMock } = await import('@/__tests__/helpers/rate-limit-mock');
 *     return rateLimitMock;
 *   });
 *   beforeEach(() => resetRateLimitMock());
 *
 * Default: all limiters resolve with { limited: false }.
 * To simulate a rate-limited response, call:
 *   rateLimitMock.rateLimitLogin.mockResolvedValueOnce({ limited: true, remaining: 0, resetInMs: 50000 });
 */

const notLimited = { limited: false, remaining: 10, resetInMs: 60_000 };

export const rateLimitMock = {
  rateLimit: vi.fn().mockResolvedValue(notLimited),
  rateLimitLogin: vi.fn().mockResolvedValue(notLimited),
  rateLimitRefresh: vi.fn().mockResolvedValue(notLimited),
  rateLimitInvite: vi.fn().mockResolvedValue(notLimited),
  rateLimitAvatarUpload: vi.fn().mockResolvedValue(notLimited),
  rateLimitComment: vi.fn().mockResolvedValue(notLimited),
  rateLimitCommentVote: vi.fn().mockResolvedValue(notLimited),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
};

export function resetRateLimitMock(): void {
  rateLimitMock.rateLimit.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitLogin.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitRefresh.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitInvite.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitAvatarUpload.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitComment.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.rateLimitCommentVote.mockReset().mockResolvedValue(notLimited);
  rateLimitMock.getClientIp.mockReset().mockReturnValue('127.0.0.1');
}

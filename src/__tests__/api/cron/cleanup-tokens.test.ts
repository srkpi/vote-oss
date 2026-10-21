import type { NextRequest } from 'next/server';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { POST } from '@/app/api/cron/cleanup-tokens/route';
import { CRON_SECRET } from '@/lib/config/server';
import { REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});

const createRequest = (token?: string) =>
  ({
    headers: {
      get: (key: string) => (key === 'authorization' ? token : null),
    },
  }) as unknown as NextRequest;

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Cleaning up expired sessions (POST /api/cron/cleanup-tokens)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no authorization header', async () => {
    const res = await POST(createRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 when authorization header is invalid', async () => {
    const res = await POST(createRequest('Bearer WRONG_SECRET'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should delete expired sessions and return the deletion count when cleanup succeeds', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 3 });

    const res = await POST(createRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          created_at: expect.any(Object),
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(json.deleted).toBe(3);
    consoleSpy.mockRestore();
  });

  it('should log the cleanup failure and return 500 when expired records cannot be deleted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.jwtToken.deleteMany.mockRejectedValueOnce(new Error('DB error'));

    const res = await POST(createRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[cron/cleanup-tokens] Failed to delete expired tokens:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('should remove sessions older than the refresh-token lifetime when cleaning up expired sessions', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fixedTime = 1_700_000_000_000; // some fixed timestamp
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedTime);

    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 0 });

    await POST(createRequest(`Bearer ${CRON_SECRET}`));

    expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          created_at: {
            lt: new Date(fixedTime - REFRESH_TOKEN_TTL_SECS * 1000),
          },
        },
      }),
    );

    dateSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

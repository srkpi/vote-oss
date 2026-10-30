import type { NextRequest } from 'next/server';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { POST } from '@/app/api/cron/cleanup-bypass/route';
import { CRON_SECRET } from '@/lib/config/server';
import { SESSION_INITIAL_AUTH_MAX_DAYS } from '@/lib/constants';

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

describe('Cleaning up expired bypass tokens (POST /api/cron/cleanup-bypass)', () => {
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

  it('should delete expired global bypass tokens and return the deletion count when cleanup succeeds', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    prismaMock.globalBypassToken.deleteMany.mockResolvedValueOnce({ count: 5 });

    const res = await POST(createRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(prismaMock.globalBypassToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          valid_until: {
            lt: expect.any(Date),
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(json.deleted).toBe(5);
    consoleSpy.mockRestore();
  });

  it('should log the cleanup failure and return 500 when expired records cannot be deleted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.globalBypassToken.deleteMany.mockRejectedValueOnce(new Error('DB error'));

    const res = await POST(createRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[cron/cleanup-bypass] Failed to delete expired bypass tokens:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('should use the current date to determine expiry when cleaning up expired bypass tokens', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mocking the system time so 'new Date()' is predictable
    const fixedTime = new Date('2026-04-02T12:00:00Z');
    const timeWithSessionMaxDays = new Date(fixedTime);
    timeWithSessionMaxDays.setDate(fixedTime.getDate() + SESSION_INITIAL_AUTH_MAX_DAYS);
    vi.useFakeTimers().setSystemTime(fixedTime);

    prismaMock.globalBypassToken.deleteMany.mockResolvedValueOnce({ count: 0 });

    await POST(createRequest(`Bearer ${CRON_SECRET}`));

    expect(prismaMock.globalBypassToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          valid_until: {
            lt: timeWithSessionMaxDays,
          },
        },
      }),
    );

    vi.useRealTimers();
    consoleSpy.mockRestore();
  });
});

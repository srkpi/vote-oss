import type { NextRequest } from 'next/server';

import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { POST } from '@/app/api/cron/cleanup-bypass/route';
import { CRON_SECRET } from '@/lib/config/server';
import { SESSION_INITIAL_AUTH_MAX_DAYS } from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const createRequest = (token?: string) =>
  ({
    headers: {
      get: (key: string) => (key === 'authorization' ? token : null),
    },
  }) as unknown as NextRequest;

describe('POST /api/cron/cleanup-bypass', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
  });

  it('returns 401 if no authorization header', async () => {
    const res = await POST(createRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 if authorization header is invalid', async () => {
    const res = await POST(createRequest('Bearer WRONG_SECRET'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('deletes expired global bypass tokens and returns count', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
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

  it('logs errors and returns 500 on failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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

  it('uses the current date to determine expiry', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Mocking the system time so 'new Date()' is predictable
    const fixedTime = new Date('2026-04-02T12:00:00Z');
    const timeWithSessionMaxDays = new Date(fixedTime);
    timeWithSessionMaxDays.setDate(fixedTime.getDate() + SESSION_INITIAL_AUTH_MAX_DAYS);
    jest.useFakeTimers().setSystemTime(fixedTime);

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

    jest.useRealTimers();
    consoleSpy.mockRestore();
  });
});

import type { NextRequest } from 'next/server';

import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { POST } from '@/app/api/cron/cleanup-tokens/route';
import { CRON_SECRET } from '@/lib/config/server';
import { REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const createRequest = (token?: string) =>
  ({
    headers: {
      get: (key: string) => (key === 'authorization' ? token : null),
    },
  }) as unknown as NextRequest;

describe('POST /api/cron/cleanup-tokens', () => {
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

  it('deletes expired tokens and returns count', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
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

  it('logs errors and returns 500 on failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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

  it('uses correct expiry date based on REFRESH_TOKEN_TTL_SECS', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fixedTime = 1_700_000_000_000; // some fixed timestamp
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedTime);

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

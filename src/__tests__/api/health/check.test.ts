import * as allure from 'allure-js-commons';

import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { redisMock, resetRedisMock } from '@/__tests__/helpers/redis-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/redis', () => ({ redis: redisMock }));

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetRedisMock();
    allure.feature('Health Check');
    allure.story('GET /api/health');
  });

  it('returns 200 when both DB and Redis are healthy', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce(1);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ status: 'ok' });
  });

  it('returns 503 when DB check fails', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(false);
    expect(json.redis).toBe(true);
    spy.mockRestore();
  });

  it('returns 503 when Redis check fails', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce(1);
    redisMock.ping.mockRejectedValueOnce(new Error('Redis down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(true);
    expect(json.redis).toBe(false);
    spy.mockRestore();
  });

  it('returns 503 when both DB and Redis fail', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
    redisMock.ping.mockRejectedValueOnce(new Error('Redis down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(false);
    expect(json.redis).toBe(false);
    spy.mockRestore();
  });

  it('handles unexpected ping responses gracefully', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce(1);
    redisMock.ping.mockResolvedValueOnce('INVALID');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(true);
    expect(json.redis).toBe(false);
    spy.mockRestore();
  });

  it('logs errors without throwing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
    redisMock.ping.mockRejectedValueOnce(new Error('Redis down'));

    const res = await GET();
    const json = await res.json();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[health] DB health check failed:',
      expect.any(Error),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[health] Redis health check failed:',
      expect.any(Error),
    );
    expect(res.status).toBe(503);
    expect(json.db).toBe(false);
    expect(json.redis).toBe(false);
    consoleErrorSpy.mockRestore();
  });
});

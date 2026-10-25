import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { redisMock, resetRedisMock } from '@/__tests__/helpers/redis-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/redis', async () => {
  const { redisMock } = await import('@/__tests__/helpers/redis-mock');
  return { redis: redisMock };
});

import { GET } from '@/app/api/health/route';

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetRedisMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Checking service health (GET /api/health)', () => {
  beforeEach(() => {
    allure.feature('Health Check');
    allure.story('GET /api/health');
  });

  it('should return 200 when both DB and Redis are healthy', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce(1);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ status: 'ok' });
  });

  it('should return 503 when DB check fails', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(false);
    expect(json.redis).toBe(true);
    spy.mockRestore();
  });

  it('should return 503 when Redis check fails', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce(1);
    redisMock.ping.mockRejectedValueOnce(new Error('Redis down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(true);
    expect(json.redis).toBe(false);
    spy.mockRestore();
  });

  it('should return 503 when both DB and Redis fail', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
    redisMock.ping.mockRejectedValueOnce(new Error('Redis down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(false);
    expect(json.redis).toBe(false);
    spy.mockRestore();
  });

  it('should report Redis as unhealthy when its ping response is unexpected', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce(1);
    redisMock.ping.mockResolvedValueOnce('INVALID');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('unavailable');
    expect(json.db).toBe(true);
    expect(json.redis).toBe(false);
    spy.mockRestore();
  });

  it('should record dependency failures when checking service health', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

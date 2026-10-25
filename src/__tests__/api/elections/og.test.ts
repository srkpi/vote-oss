import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { MOCK_ELECTION_ID } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/cache', async () => {
  const { cacheMock } = await import('@/__tests__/helpers/cache-mock');
  return cacheMock;
});

import { GET } from '@/app/api/elections/[id]/og/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetCacheMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Loading an election preview (GET /api/elections/[id]/og)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Open Graph Metadata');
  });

  it('should return 400 for invalid uuid when loading an election preview', async () => {
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'invalid' }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 404 when election does not exist', async () => {
    prismaMock.election.findUnique.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(), PARAMS);

    expect(res.status).toBe(404);
  });

  it('should return 200 with data from DB when the cache is empty', async () => {
    prismaMock.election.findUnique.mockResolvedValueOnce({
      title: 'Student Election',
      type: 'ELECTION',
    });

    const res = await GET(makeRequest(), PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body).toEqual({ title: 'Student Election', type: 'ELECTION' });

    expect(prismaMock.election.findUnique).toHaveBeenCalledWith({
      where: { id: MOCK_ELECTION_ID, deleted_at: null },
      select: { title: true, type: true },
    });
  });

  it('should return 200 from cache when available', async () => {
    cacheMock.getCachedElections.mockResolvedValueOnce([
      {
        id: MOCK_ELECTION_ID,
        title: 'Cached Election',
        type: 'ELECTION',
      },
    ] as any);

    const res = await GET(makeRequest(), PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body).toEqual({ title: 'Cached Election', type: 'ELECTION' });

    expect(prismaMock.election.findUnique).not.toHaveBeenCalled();
  });

  it('should return 404 when cached elections exist but id not found', async () => {
    cacheMock.getCachedElections.mockResolvedValueOnce([
      { id: 'other-id', title: 'Other', type: 'ELECTION' },
    ] as any);

    const res = await GET(makeRequest(), PARAMS);

    expect(res.status).toBe(404);
    expect(prismaMock.election.findUnique).not.toHaveBeenCalled();
  });
});

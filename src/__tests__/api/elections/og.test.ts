import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { MOCK_ELECTION_ID } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeRequest, parseJson } from '@/__tests__/helpers/request';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/cache', () => cacheMock);

import { GET } from '@/app/api/elections/[id]/og/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

describe('GET /api/elections/[id]/og', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetCacheMock();

    allure.feature('Elections');
    allure.story('Open Graph Metadata');
  });

  it('returns 400 for invalid uuid', async () => {
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'invalid' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    prismaMock.election.findUnique.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(), PARAMS);

    expect(res.status).toBe(404);
  });

  it('returns 200 with data from DB when cache is empty', async () => {
    prismaMock.election.findUnique.mockResolvedValueOnce({
      title: 'Student Election',
    });

    const res = await GET(makeRequest(), PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body).toEqual({ title: 'Student Election' });

    expect(prismaMock.election.findUnique).toHaveBeenCalledWith({
      where: { id: MOCK_ELECTION_ID, deleted_at: null },
      select: { title: true },
    });
  });

  it('returns 200 from cache when available', async () => {
    cacheMock.getCachedElections.mockResolvedValueOnce([
      {
        id: MOCK_ELECTION_ID,
        title: 'Cached Election',
      },
    ] as any);

    const res = await GET(makeRequest(), PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body).toEqual({ title: 'Cached Election' });

    expect(prismaMock.election.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when cached elections exist but id not found', async () => {
    cacheMock.getCachedElections.mockResolvedValueOnce([{ id: 'other-id', title: 'Other' }] as any);

    const res = await GET(makeRequest(), PARAMS);

    expect(res.status).toBe(404);
    expect(prismaMock.election.findUnique).not.toHaveBeenCalled();
  });
});

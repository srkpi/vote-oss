import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '../../helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  makeElection,
  makeTokenPair,
  USER_PAYLOAD,
} from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { GET, POST } from '@/app/api/elections/route';

// ── helpers ───────────────────────────────────────────────────────────────────

async function makeAuthReq(payload = USER_PAYLOAD) {
  const { access } = await makeTokenPair(payload);
  tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
  return makeAuthRequest(access.token);
}

async function makeAdminReq(body: object, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

// ── GET /api/elections ────────────────────────────────────────────────────────

describe('GET /api/elections', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('List Elections');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns cached data immediately on a cache hit (no DB query)', async () => {
    const req = await makeAuthReq();
    const cached = [{ id: 99, title: 'Cached' }];
    cacheMock.getCachedElections.mockResolvedValueOnce(cached as any);

    const res = await GET(req);
    const { status, body } = await parseJson<any[]>(res);

    expect(status).toBe(200);
    expect(body).toEqual(cached);
    expect(prismaMock.election.findMany).not.toHaveBeenCalled();
  });

  it('queries the DB on a cache miss', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce(null); // miss
    prismaMock.election.findMany.mockResolvedValueOnce([]);

    await GET(req);
    expect(prismaMock.election.findMany).toHaveBeenCalledTimes(1);
  });

  it('populates the cache after a DB hit', async () => {
    const req = await makeAuthReq();
    const election = makeElection();
    cacheMock.getCachedElections.mockResolvedValueOnce(null);
    prismaMock.election.findMany.mockResolvedValueOnce([
      {
        ...election,
        private_key: election.private_key,
        creator: { full_name: 'Admin', faculty: 'FICE' },
        choices: election.choices,
        _count: { ballots: 0 },
      },
    ]);

    await GET(req);
    expect(cacheMock.setCachedElections).toHaveBeenCalledWith(
      USER_PAYLOAD.faculty,
      USER_PAYLOAD.group,
      expect.any(Array),
    );
  });

  it('filters by the requesting user faculty and group', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce(null);
    prismaMock.election.findMany.mockResolvedValueOnce([]);

    await GET(req);
    const { where } = prismaMock.election.findMany.mock.calls[0][0];
    expect(where.AND[0].OR).toEqual(
      expect.arrayContaining([
        { restricted_to_faculty: null },
        { restricted_to_faculty: USER_PAYLOAD.faculty },
      ]),
    );
  });

  it('does not expose privateKey for open elections', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce(null);
    const election = makeElection(); // open by default
    prismaMock.election.findMany.mockResolvedValueOnce([
      {
        ...election,
        private_key: election.private_key,
        creator: { full_name: 'Admin', faculty: 'FICE' },
        choices: election.choices,
        _count: { ballots: 0 },
      },
    ]);

    const res = await GET(req);
    const { body } = await parseJson<any[]>(res);
    expect(body[0].privateKey).toBeUndefined();
  });

  it('exposes privateKey for closed elections', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce(null);
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });
    prismaMock.election.findMany.mockResolvedValueOnce([
      {
        ...election,
        private_key: election.private_key,
        creator: { full_name: 'Admin', faculty: 'FICE' },
        choices: election.choices,
        _count: { ballots: 0 },
      },
    ]);

    const res = await GET(req);
    const { body } = await parseJson<any[]>(res);
    expect(body[0].privateKey).toBeDefined();
  });

  it('includes status field (upcoming/open/closed)', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce(null);
    const election = makeElection(); // open
    prismaMock.election.findMany.mockResolvedValueOnce([
      {
        ...election,
        private_key: election.private_key,
        creator: { full_name: 'Admin', faculty: 'FICE' },
        choices: election.choices,
        _count: { ballots: 0 },
      },
    ]);

    const res = await GET(req);
    const { body } = await parseJson<any[]>(res);
    expect(body[0].status).toBe('open');
  });

  it('returns 200 with empty array when no elections exist', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce(null);
    prismaMock.election.findMany.mockResolvedValueOnce([]);

    const { status, body } = await parseJson<any[]>(await GET(req));
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});

// ── POST /api/elections ───────────────────────────────────────────────────────

describe('POST /api/elections', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Create Election');
  });

  const validBody = {
    title: 'New Election',
    opensAt: new Date(Date.now() + 3_600_000).toISOString(),
    closesAt: new Date(Date.now() + 7_200_000).toISOString(),
    choices: ['Option A', 'Option B'],
  };

  it('returns 403 for a non-admin user', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
    const req = makeAuthRequest(access.token, { method: 'POST', body: validBody });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    const req = await makeAdminReq({ title: 'Only title' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when fewer than 2 choices are provided', async () => {
    const req = await makeAdminReq({ ...validBody, choices: ['Only one'] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when closesAt is before opensAt', async () => {
    const req = await makeAdminReq({
      ...validBody,
      opensAt: new Date(Date.now() + 7_200_000).toISOString(),
      closesAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 with election data on success', async () => {
    const req = await makeAdminReq(validBody);
    const election = makeElection();
    prismaMock.election.create.mockResolvedValueOnce({
      ...election,
      opens_at: new Date(validBody.opensAt),
      closes_at: new Date(validBody.closesAt),
    });

    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
    expect(body.title).toBe(election.title);
    expect(body.choices).toBeDefined();
  });

  it('invalidates the elections cache after creation', async () => {
    const req = await makeAdminReq(validBody);
    const election = makeElection();
    prismaMock.election.create.mockResolvedValueOnce({
      ...election,
      opens_at: new Date(validBody.opensAt),
      closes_at: new Date(validBody.closesAt),
    });

    await POST(req);
    expect(cacheMock.invalidateElections).toHaveBeenCalledTimes(1);
  });

  it('enforces faculty restriction for restricted admins', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      { ...validBody, restrictedToFaculty: null }, // tries to create unrestricted
      restrictedAdmin,
    );
    const election = makeElection();
    prismaMock.election.create.mockResolvedValueOnce({
      ...election,
      opens_at: new Date(validBody.opensAt),
      closes_at: new Date(validBody.closesAt),
    });

    await POST(req);
    const createArgs = prismaMock.election.create.mock.calls[0][0].data;
    expect(createArgs.restricted_to_faculty).toBe('FICE');
  });
});

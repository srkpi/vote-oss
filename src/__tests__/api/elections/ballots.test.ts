import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, parseJson } from '../../helpers/request';
import {
  makeTokenPair,
  USER_PAYLOAD,
  JWT_TOKEN_RECORD,
  makeElection,
} from '../../helpers/fixtures';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from '@/app/api/elections/[id]/ballots/route';

const PARAMS = { params: { id: '1' } };

async function authReq(searchParams: Record<string, string> = {}) {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token, {
    url: 'http://localhost/api/elections/1/ballots',
    searchParams,
  });
}

const MOCK_BALLOT = {
  id: 1,
  encrypted_ballot: 'enc-data-base64',
  created_at: new Date(),
  signature: 'sig-base64',
  previous_hash: null,
  current_hash: 'abc123',
};

describe('GET /api/elections/[id]/ballots', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Elections');
    allure.story('Public Ballot Transparency');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-numeric election id', async () => {
    const req = await authReq();
    const res = await GET(req, { params: { id: 'bad' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns paginated ballots with correct shape', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([MOCK_BALLOT]);
    prismaMock.ballot.count.mockResolvedValueOnce(1);

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ballots).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
    expect(body.pagination.page).toBe(1);
    expect(body.election.id).toBe(1);
  });

  it('exposes encrypted_ballot, signature, and chain hashes', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([MOCK_BALLOT]);
    prismaMock.ballot.count.mockResolvedValueOnce(1);

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    const ballot = body.ballots[0];

    expect(ballot.encrypted_ballot).toBeDefined();
    expect(ballot.signature).toBeDefined();
    expect(ballot.current_hash).toBeDefined();
    expect(ballot.previous_hash).toBeDefined();
  });

  it('respects page and pageSize query parameters', async () => {
    const req = await authReq({ page: '2', pageSize: '5' });
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.ballot.count.mockResolvedValueOnce(10);

    await GET(req, PARAMS);

    expect(prismaMock.ballot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it('caps pageSize at 100', async () => {
    const req = await authReq({ pageSize: '9999' });
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.ballot.count.mockResolvedValueOnce(0);

    await GET(req, PARAMS);

    expect(prismaMock.ballot.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('returns empty ballots array when no votes have been cast', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.ballot.count.mockResolvedValueOnce(0);

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.ballots).toHaveLength(0);
    expect(body.pagination.totalPages).toBe(0);
  });
});

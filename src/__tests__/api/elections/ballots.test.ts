import * as allure from 'allure-js-commons';

import {
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_ID,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);

import { GET } from '@/app/api/elections/[id]/ballots/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authReq() {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

  return makeAuthRequest(access.token, {
    url: 'http://localhost/api/elections/1/ballots',
  });
}

const MOCK_BALLOT = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  encrypted_ballot: 'enc-data-base64',
  created_at: new Date(),
  signature: 'sig-base64',
  previous_hash: null,
  current_hash: 'abc123',
};

describe('GET /api/elections/[id]/ballots', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Elections');
    allure.story('Public Ballot Transparency');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(401);
  });

  it('returns 400 for non-uuid election id', async () => {
    const req = await authReq();

    const res = await GET(req, {
      params: Promise.resolve({ id: 'bad' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await authReq();

    prismaMock.election.findUnique.mockResolvedValueOnce(null);

    const res = await GET(req, PARAMS);

    expect(res.status).toBe(404);
  });

  it('returns ballots for the election', async () => {
    const req = await authReq();

    const mockElection = makeElection();
    prismaMock.election.findUnique.mockResolvedValueOnce(mockElection);
    prismaMock.ballot.findMany.mockResolvedValueOnce([MOCK_BALLOT]);

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ballots).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.election.id).toBe(mockElection.id);
    expect(body.ballots[0].id).toBe(MOCK_BALLOT.id);
  });

  it('returns ballots ordered by id ascending', async () => {
    const req = await authReq();

    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([MOCK_BALLOT]);

    await GET(req, PARAMS);

    expect(prismaMock.ballot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { created_at: 'asc' },
      }),
    );
  });

  it('exposes encrypted ballot, signature and hash chain', async () => {
    const req = await authReq();

    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([MOCK_BALLOT]);

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);

    const ballot = body.ballots[0];

    expect(ballot.encrypted_ballot).toBeDefined();
    expect(ballot.signature).toBeDefined();
    expect(ballot.current_hash).toBeDefined();
    expect(ballot.previous_hash).toBeDefined();
  });

  it('returns empty ballots array when no votes exist', async () => {
    const req = await authReq();

    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);

    expect(body.ballots).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});

import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, parseJson } from '../../helpers/request';
import {
  makeTokenPair,
  USER_PAYLOAD,
  JWT_TOKEN_RECORD,
  makeElection,
  encryptChoice,
} from '../../helpers/fixtures';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from '@/app/api/elections/[id]/tally/route';

const PARAMS = { params: { id: '1' } };

async function authReq() {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token);
}

describe('GET /api/elections/[id]/tally', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Elections');
    allure.story('Election Tally');
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

  it('returns 400 when election has not closed yet', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection(), // opens_at past, closes_at future
    );
    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);
    expect(status).toBe(400);
    expect(body.message).toMatch(/not closed/i);
  });

  it('returns cached tallies when already computed', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [
        { election_id: 1, choice_id: 10, vote_count: 5 },
        { election_id: 1, choice_id: 11, vote_count: 3 },
      ] as any,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.results).toHaveLength(2);
    const optA = body.results.find((r: any) => r.choiceId === 10);
    expect(optA.votes).toBe(5);
    // Should NOT re-query ballots since tallies are cached
    expect(prismaMock.ballot.findMany).not.toHaveBeenCalled();
  });

  it('exposes private key in tally response after close', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [{ election_id: 1, choice_id: 10, vote_count: 2 }] as any,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.privateKey).toBeDefined();
    expect(body.privateKey).toMatch(/-----BEGIN PRIVATE KEY-----/);
  });

  it('computes tallies from ballots when not yet cached', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [] as any,
    });

    // Encrypt two ballots: one for choice 10, one for choice 11
    const ballot1 = encryptChoice(election.public_key, 10);
    const ballot2 = encryptChoice(election.public_key, 11);

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([
      { encrypted_ballot: ballot1 },
      { encrypted_ballot: ballot2 },
    ]);
    prismaMock.electionTally.createMany.mockResolvedValueOnce({ count: 2 });

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    const choice10 = body.results.find((r: any) => r.choiceId === 10);
    const choice11 = body.results.find((r: any) => r.choiceId === 11);
    expect(choice10.votes).toBe(1);
    expect(choice11.votes).toBe(1);
    expect(body.totalBallots).toBe(2);
  });

  it('persists computed tallies to DB after calculating', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [] as any,
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.electionTally.createMany.mockResolvedValueOnce({ count: 2 });

    await GET(req, PARAMS);

    expect(prismaMock.electionTally.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ election_id: 1 })]),
        skipDuplicates: true,
      }),
    );
  });

  it('skips malformed (un-decryptable) ballots gracefully', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [] as any,
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([
      { encrypted_ballot: 'corrupt-base64-data' }, // should be skipped
    ]);
    prismaMock.electionTally.createMany.mockResolvedValueOnce({ count: 2 });

    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
  });
});

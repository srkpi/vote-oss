import * as allure from 'allure-js-commons';

import {
  encryptBallot,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_CHOICES,
  MOCK_ELECTION_ID,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);

import { GET } from '@/app/api/elections/[id]/tally/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authReq() {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token);
}

describe('GET /api/elections/[id]/tally', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Elections');
    allure.story('Election Tally');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-uuid election id', async () => {
    const req = await authReq();
    const res = await GET(req, { params: Promise.resolve({ id: 'bad' }) });
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
        { election_id: MOCK_ELECTION_ID, choice_id: MOCK_ELECTION_CHOICES[0].id, vote_count: 5 },
        { election_id: MOCK_ELECTION_ID, choice_id: MOCK_ELECTION_CHOICES[1].id, vote_count: 3 },
      ] as any,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.results).toHaveLength(2);
    const optA = body.results.find((r: any) => r.choiceId === MOCK_ELECTION_CHOICES[0].id);
    expect(optA.votes).toBe(5);
    // Should NOT re-query ballots since tallies are cached
    expect(prismaMock.ballot.findMany).not.toHaveBeenCalled();
  });

  it('exposes private key in tally response after close', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [
        { election_id: MOCK_ELECTION_ID, choice_id: MOCK_ELECTION_CHOICES[0].id, vote_count: 2 },
      ] as any,
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

    // Encrypt each ballot using the hybrid scheme with the election's max_choices
    const ballot1 = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[0].id],
      election.max_choices,
    );
    const ballot2 = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[1].id],
      election.max_choices,
    );

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([
      { encrypted_ballot: ballot1 },
      { encrypted_ballot: ballot2 },
    ]);
    prismaMock.electionTally.createMany.mockResolvedValueOnce({ count: 2 });

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    const choice1 = body.results.find((r: any) => r.choiceId === MOCK_ELECTION_CHOICES[0].id);
    const choice2 = body.results.find((r: any) => r.choiceId === MOCK_ELECTION_CHOICES[1].id);
    expect(choice1.votes).toBe(1);
    expect(choice2.votes).toBe(1);
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
        data: expect.arrayContaining([expect.objectContaining({ election_id: MOCK_ELECTION_ID })]),
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
      { encrypted_ballot: 'bm90LXZhbGlkLWpzb24=' }, // base64("not-valid-json") — should be skipped
    ]);
    prismaMock.electionTally.createMany.mockResolvedValueOnce({ count: 2 });

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it('deletes issued tokens after computing tallies for the first time', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [] as any,
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.electionTally.createMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.issuedToken.deleteMany.mockResolvedValueOnce({ count: 3 });

    await GET(req, PARAMS);

    expect(prismaMock.issuedToken.deleteMany).toHaveBeenCalledWith({
      where: { election_id: MOCK_ELECTION_ID },
    });
  });

  it('deletes nullifiers after computing tallies for the first time', async () => {
    const req = await authReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      tallies: [] as any,
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.electionTally.createMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.issuedToken.deleteMany.mockResolvedValueOnce({ count: 3 });

    await GET(req, PARAMS);

    expect(prismaMock.usedTokenNullifier.deleteMany).toHaveBeenCalledWith({
      where: { election_id: MOCK_ELECTION_ID },
    });
  });
});

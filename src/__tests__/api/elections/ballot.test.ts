import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  encryptBallot,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  makeVoteBallot,
  MOCK_ELECTION_CHOICES,
  MOCK_ELECTION_ID,
  MOCK_ELECTION_ID_NOT_EXISTING,
  MOCK_ELECTION_INVALID_CHOICE_ID,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { computeNullifier, generateVoteToken, signVoteToken } from '@/lib/crypto';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
vi.mock('@/lib/cache', async () => {
  const { cacheMock } = await import('@/__tests__/helpers/cache-mock');
  return cacheMock;
});
vi.mock('@/lib/encryption', () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));

import { POST } from '@/app/api/elections/[id]/ballot/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authReq(body: object) {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Submitting a ballot (POST /api/elections/[id]/ballot)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Submit Ballot');
  });

  it('should return 401 when no user is signed in', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('should return 400 for non-uuid election id when submitting a ballot', async () => {
    const req = await authReq({});
    const res = await POST(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('should return 400 when required fields are missing', async () => {
    const req = await authReq({ token: 'x' }); // missing signature, encryptedBallot, nullifier
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 404 when election does not exist', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('should return 400 when election has not started', async () => {
    const election = makeElection({
      opens_at: new Date(Date.now() + 3_600_000),
      closes_at: new Date(Date.now() + 7_200_000),
    });
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 400 when election has closed', async () => {
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 3_600_000),
    });
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it.each([
    { label: '1ms before opening', offset: -1, status: 400 },
    { label: 'exactly at opening', offset: 0, status: 201 },
    { label: '1ms after opening', offset: 1, status: 201 },
    { label: '1ms before closing', offset: 59_999, status: 201 },
    { label: 'exactly at closing', offset: 60_000, status: 201 },
    { label: '1ms after closing', offset: 60_001, status: 400 },
  ])('should return $status when a ballot is submitted $label', async ({ offset, status }) => {
    vi.setSystemTime(TEST_NOW + offset);
    const election = makeElection({
      opens_at: new Date(TEST_NOW),
      closes_at: new Date(TEST_NOW + 60_000),
    });
    const req = await authReq(makeVoteBallot(election));
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    prismaMock.ballot.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    expect((await POST(req, PARAMS)).status).toBe(status);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(status === 201 ? 1 : 0);
  });

  it('should return 400 when vote token signature is invalid', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq({ ...ballot, signature: 'invalidsignature' });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 400 when token belongs to a different election', async () => {
    const election = makeElection();
    const { token: wrongToken } = generateVoteToken(MOCK_ELECTION_ID_NOT_EXISTING);
    const signature = signVoteToken(election.private_key, wrongToken);
    const nullifier = computeNullifier(wrongToken);
    const encryptedBallot = encryptBallot(
      election.public_key,
      [election.choices[0].id],
      election.max_choices,
    );
    const req = await authReq({ token: wrongToken, signature, nullifier, encryptedBallot });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 400 when nullifier does not match H(token)', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq({ ...ballot, nullifier: 'wrong-nullifier' });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 409 when nullifier already used (double-vote attempt)', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce({ nullifier: ballot.nullifier });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
  });

  it('should return 400 when encrypted ballot decrypts to invalid choice id', async () => {
    const election = makeElection();
    const { token } = generateVoteToken(election.id);
    const signature = signVoteToken(election.private_key, token);
    const nullifier = computeNullifier(token);
    const encryptedBallot = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_INVALID_CHOICE_ID],
      election.max_choices,
    );
    const req = await authReq({ token, signature, nullifier, encryptedBallot });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 400 when encrypted ballot is garbage', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq({ ...ballot, encryptedBallot: 'bm90LXZhbGlkLWpzb24=' }); // base64 of "not-valid-json"
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 400 when number of choices exceeds max_choices', async () => {
    const election = makeElection({ min_choices: 1, max_choices: 1 });
    const { token } = generateVoteToken(election.id);
    const signature = signVoteToken(election.private_key, token);
    const nullifier = computeNullifier(token);
    const encryptedBallot = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[0].id, MOCK_ELECTION_CHOICES[1].id],
      election.max_choices,
    );
    const req = await authReq({ token, signature, nullifier, encryptedBallot });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('should return 201 with ballotHash for a fully valid single-choice submission when submitting a ballot', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    prismaMock.ballot.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const res = await POST(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(201);
    expect(typeof body.ballotHash).toBe('string');
    expect(body.ballotHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should link the new ballot to the previous ballot when the election already has votes', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);
    const prevHash = 'a'.repeat(64);

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    prismaMock.ballot.findFirst.mockResolvedValueOnce({ current_hash: prevHash });
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    await POST(req, PARAMS);

    const txCall = prismaMock.$transaction.mock.calls[0][0];
    const ballotCreate = txCall.find((op: any) => op?.data?.previous_hash !== undefined);
    expect(ballotCreate?.data?.previous_hash).toBe(prevHash);
  });

  it('should return 201 for valid multi-choice submission when max_choices=2', async () => {
    const election = makeElection({ min_choices: 1, max_choices: 2 });
    const { token } = generateVoteToken(election.id);
    const signature = signVoteToken(election.private_key, token);
    const nullifier = computeNullifier(token);
    const encryptedBallot = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[0].id, MOCK_ELECTION_CHOICES[1].id],
      election.max_choices,
    );
    const req = await authReq({ token, signature, nullifier, encryptedBallot });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    prismaMock.ballot.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(201);
  });

  it('should save the ballot and its spent-token marker together when accepting a vote', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    prismaMock.ballot.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    await POST(req, PARAMS);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should increment the live ballot count after a ballot is accepted', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    prismaMock.ballot.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    await POST(req, PARAMS);

    expect(cacheMock.incrementLiveElectionBallotCount).toHaveBeenCalledTimes(1);
  });
});

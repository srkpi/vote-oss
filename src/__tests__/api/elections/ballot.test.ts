import * as allure from 'allure-js-commons';

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
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { computeNullifier, generateVoteToken, signVoteToken } from '@/lib/crypto';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { POST } from '@/app/api/elections/[id]/ballot/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authReq(body: object) {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

describe('POST /api/elections/[id]/ballot', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Submit Ballot');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-uuid election id', async () => {
    const req = await authReq({});
    const res = await POST(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const req = await authReq({ token: 'x' }); // missing signature, encryptedBallot, nullifier
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 400 when election has not started', async () => {
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

  it('returns 400 when election has closed', async () => {
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

  it('returns 400 when vote token signature is invalid', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq({ ...ballot, signature: 'invalidsignature' });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 400 when token belongs to a different election', async () => {
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

  it('returns 400 when nullifier does not match H(token)', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq({ ...ballot, nullifier: 'wrong-nullifier' });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 409 when nullifier already used (double-vote attempt)', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq(ballot);
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce({ nullifier: ballot.nullifier });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
  });

  it('returns 400 when encrypted ballot decrypts to invalid choice id', async () => {
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

  it('returns 400 when encrypted ballot is garbage', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq({ ...ballot, encryptedBallot: 'bm90LXZhbGlkLWpzb24=' }); // base64 of "not-valid-json"
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 400 when number of choices exceeds max_choices', async () => {
    const election = makeElection({ min_choices: 1, max_choices: 1 });
    const { token } = generateVoteToken(election.id);
    const signature = signVoteToken(election.private_key, token);
    const nullifier = computeNullifier(token);
    // Encrypt 2 choices but max is 1 — no padding applied since length >= maxChoices
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

  it('returns 201 with ballotHash for a fully valid single-choice submission', async () => {
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

  it('chains to previous ballot hash when one exists', async () => {
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

  it('returns 201 for valid multi-choice submission when max_choices=2', async () => {
    const election = makeElection({ min_choices: 1, max_choices: 2 });
    const { token } = generateVoteToken(election.id);
    const signature = signVoteToken(election.private_key, token);
    const nullifier = computeNullifier(token);
    const encryptedBallot = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[0].id, MOCK_ELECTION_CHOICES[1].id],
      election.max_choices, // max_choices=2, no padding needed
    );
    const req = await authReq({ token, signature, nullifier, encryptedBallot });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    prismaMock.ballot.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(201);
  });

  it('persists nullifier and ballot atomically via $transaction', async () => {
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
});

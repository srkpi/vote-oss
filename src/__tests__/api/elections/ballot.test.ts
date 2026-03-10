import * as allure from 'allure-js-commons';

import { computeNullifier, generateVoteToken, signVoteToken } from '@/lib/crypto';

import { cacheMock, resetCacheMock } from '../../helpers/cache-mock';
import {
  encryptChoice,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  makeVoteBallot,
  USER_PAYLOAD,
} from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { POST } from '@/app/api/elections/[id]/ballot/route';

const PARAMS = { params: Promise.resolve({ id: '1' }) };

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

  it('returns 400 for non-numeric election id', async () => {
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
    const { token: wrongToken } = generateVoteToken(999); // election 999 != 1
    const signature = signVoteToken(election.private_key, wrongToken);
    const nullifier = computeNullifier(wrongToken);
    const encryptedBallot = encryptChoice(election.public_key, 10);

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
    const { token } = generateVoteToken(1);
    const signature = signVoteToken(election.private_key, token);
    const nullifier = computeNullifier(token);
    const encryptedBallot = encryptChoice(election.public_key, 9999); // invalid choice

    const req = await authReq({ token, signature, nullifier, encryptedBallot });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 400 when encrypted ballot is garbage', async () => {
    const election = makeElection();
    const ballot = makeVoteBallot(election);
    const req = await authReq({ ...ballot, encryptedBallot: 'not-valid-base64-rsa==' });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.usedTokenNullifier.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 201 with ballotHash for a fully valid submission', async () => {
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
    expect(body.ok).toBe(true);
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

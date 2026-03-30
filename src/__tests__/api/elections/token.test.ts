import * as allure from 'allure-js-commons';

import {
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_ID,
  OTHER_FACULTY_PAYLOAD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/encryption', () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));

import { POST } from '@/app/api/elections/[id]/token/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authReq(payload = USER_PAYLOAD) {
  const { access } = await makeTokenPair(payload);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST' });
}

describe('POST /api/elections/[id]/token', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Elections');
    allure.story('Issue Vote Token');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-uuid election id', async () => {
    const req = await authReq();
    const res = await POST(req, { params: Promise.resolve({ id: 'xyz' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 400 when election has not started yet', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() + 3_600_000),
        closes_at: new Date(Date.now() + 7_200_000),
      }),
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 400 when election has already closed', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 3_600_000),
      }),
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 403 when user faculty does not match restriction', async () => {
    const req = await authReq(OTHER_FACULTY_PAYLOAD); // FEL
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ restrictions: [{ type: 'FACULTY', value: 'FICE' }] }),
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user group does not match restriction', async () => {
    const req = await authReq(USER_PAYLOAD); // KV-91
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        restrictions: [
          { type: 'FACULTY', value: 'FICE' },
          { type: 'GROUP', value: 'KV-99' },
        ],
      }),
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 409 when vote token is already issued to this user', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce({ id: MOCK_ELECTION_ID });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
  });

  it('returns 200 with token and signature for eligible user', async () => {
    const req = await authReq();
    const election = makeElection();
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce(null);
    prismaMock.issuedToken.create.mockResolvedValueOnce({});

    const res = await POST(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(typeof body.token).toBe('string');
    expect(typeof body.signature).toBe('string');
    expect(body.token.startsWith(`${MOCK_ELECTION_ID}:`)).toBe(true);
  });

  it('issued token signature is verifiable with election public key', async () => {
    const req = await authReq();
    const election = makeElection();
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce(null);
    prismaMock.issuedToken.create.mockResolvedValueOnce({});

    const res = await POST(req, PARAMS);
    const { body } = await parseJson<any>(res);

    const { verifyVoteTokenSignature } = await import('@/lib/crypto');
    expect(verifyVoteTokenSignature(election.public_key, body.token, body.signature)).toBe(true);
  });

  it('records token issuance in the database', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce(null);
    prismaMock.issuedToken.create.mockResolvedValueOnce({});

    await POST(req, PARAMS);

    expect(prismaMock.issuedToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { election_id: MOCK_ELECTION_ID, user_id: USER_PAYLOAD.sub },
      }),
    );
  });
});

import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, parseJson } from '../../helpers/request';
import {
  makeTokenPair,
  USER_PAYLOAD,
  OTHER_FACULTY_PAYLOAD,
  JWT_TOKEN_RECORD,
  makeElection,
} from '../../helpers/fixtures';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/elections/[id]/token/route';

const PARAMS = { params: { id: '1' } };

async function authReq(payload = USER_PAYLOAD) {
  const { access } = await makeTokenPair(payload);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST' });
}

describe('POST /api/elections/[id]/token', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Elections');
    allure.story('Issue Vote Token');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-numeric election id', async () => {
    const req = await authReq();
    const res = await POST(req, { params: { id: 'xyz' } });
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
      makeElection({ restricted_to_faculty: 'FICS' }),
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user group does not match restriction', async () => {
    const req = await authReq(USER_PAYLOAD); // KV-91
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ restricted_to_group: 'KV-99' }),
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 409 when vote token is already issued to this user', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce({ id: 1 });
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
    expect(body.token.startsWith('1:')).toBe(true);
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
        data: { election_id: 1, user_id: USER_PAYLOAD.sub },
      }),
    );
  });
});

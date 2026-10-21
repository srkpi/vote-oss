import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { resetCacheMock } from '@/__tests__/helpers/cache-mock';
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
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock } from '@/__tests__/helpers/token-store-mock';

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
vi.mock('@/lib/bypass', () => ({
  getElectionBypassForUser: vi.fn().mockResolvedValue(null),
}));

import { POST } from '@/app/api/elections/[id]/token/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authReq(payload = USER_PAYLOAD) {
  const { access } = await makeTokenPair(payload);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST' });
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

describe('Requesting a voting token (POST /api/elections/[id]/token)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Issue Vote Token');
  });

  it('should return 401 when no user is signed in', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('should return 400 for non-uuid election id when requesting a voting token', async () => {
    const req = await authReq();
    const res = await POST(req, { params: Promise.resolve({ id: 'xyz' }) });
    expect(res.status).toBe(400);
  });

  it('should return 404 when election does not exist', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('should return 400 when election has not started yet', async () => {
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

  it('should return 400 when election has already closed', async () => {
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

  it('should return 403 when user faculty does not match restriction', async () => {
    const req = await authReq(OTHER_FACULTY_PAYLOAD); // FEL
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ restrictions: [{ type: 'FACULTY', value: 'FICE' }] }),
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('should return 403 when user group does not match restriction', async () => {
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

  it('should return 409 when vote token is already issued to this user', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce({ id: MOCK_ELECTION_ID });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
  });

  it('should return 200 with token and signature for eligible user when requesting a voting token', async () => {
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

  it('should issue a token that verifies with the election public key when an eligible voter requests it', async () => {
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

  it('should record that the voter received a voting token when issuance succeeds', async () => {
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

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

import { GET } from '@/app/api/elections/[id]/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authRequest(payload = USER_PAYLOAD) {
  const { access } = await makeTokenPair(payload);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token);
}

describe('GET /api/elections/[id]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Elections');
    allure.story('Election Detail');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-uuid id', async () => {
    const req = await authRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user faculty does not match restriction', async () => {
    const req = await authRequest(OTHER_FACULTY_PAYLOAD);
    const election = makeElection({ restricted_to_faculty: 'FICE' });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user group does not match restriction', async () => {
    const req = await authRequest(USER_PAYLOAD); // group KV-91
    const election = makeElection({ restricted_to_group: 'KV-99' });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 200 with full election data for eligible user', async () => {
    const req = await authRequest();
    const election = makeElection();
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.id).toBe(election.id);
    expect(body.title).toBe(election.title);
    expect(body.choices).toHaveLength(2);
    expect(body.ballotCount).toBe(0);
  });

  it('does not expose private key while election is open', async () => {
    const req = await authRequest();
    const election = makeElection();
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.privateKey).toBeUndefined();
  });

  it('exposes private key after election closes', async () => {
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.privateKey).toBeDefined();
  });
});

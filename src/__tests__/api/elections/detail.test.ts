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
    const election = makeElection({
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user group does not match restriction', async () => {
    const req = await authRequest(USER_PAYLOAD); // group KV-91
    const election = makeElection({
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'GROUP', value: 'KV-99' },
      ],
    });
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

  // ── hasVoted ──────────────────────────────────────────────────────────────

  it('returns hasVoted false for an open election when no token has been issued', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection()); // open

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBe(false);
  });

  it('returns hasVoted true for an open election when the user has an issued token', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection()); // open
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce({
      id: 'tok-1',
      election_id: MOCK_ELECTION_ID,
      user_id: USER_PAYLOAD.sub,
    });

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBe(true);
  });

  it('queries issuedToken with the correct election_id and user_id', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection()); // open

    await GET(req, PARAMS);

    expect(prismaMock.issuedToken.findUnique).toHaveBeenCalledWith({
      where: {
        election_id_user_id: {
          election_id: MOCK_ELECTION_ID,
          user_id: USER_PAYLOAD.sub,
        },
      },
    });
  });

  it('does not include hasVoted for an upcoming election', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() + 3_600_000),
        closes_at: new Date(Date.now() + 7_200_000),
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBeUndefined();
  });

  it('does not include hasVoted for a closed election', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBeUndefined();
  });

  it('does not call issuedToken.findUnique for upcoming elections', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() + 3_600_000),
        closes_at: new Date(Date.now() + 7_200_000),
      }),
    );

    await GET(req, PARAMS);
    expect(prismaMock.issuedToken.findUnique).not.toHaveBeenCalled();
  });

  it('does not call issuedToken.findUnique for closed elections', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
      }),
    );

    await GET(req, PARAMS);
    expect(prismaMock.issuedToken.findUnique).not.toHaveBeenCalled();
  });
});

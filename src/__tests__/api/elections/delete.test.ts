import * as allure from 'allure-js-commons';

import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_ID,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => ({
  invalidateElections: jest.fn().mockResolvedValue(undefined),
  getCachedElections: jest.fn().mockResolvedValue(null),
}));

import { DELETE } from '@/app/api/elections/[id]/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

async function restrictedAdminReq() {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

describe('DELETE /api/elections/[id]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Elections');
    allure.story('Delete Election');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 400 for a non-uuid election id', async () => {
    const req = await adminReq();
    const res = await DELETE(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await adminReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 403 when restricted admin tries to delete an unrestricted election', async () => {
    const req = await restrictedAdminReq(); // faculty=FICE, restricted_to_faculty=true
    // Election open to everyone (no faculty restriction)
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 403 when restricted admin tries to delete another faculty election', async () => {
    const req = await restrictedAdminReq(); // faculty=FICE
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ restrictions: [{ type: 'FACULTY', value: 'FEL' }] }),
    );
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 200 when restricted admin deletes an election from their own faculty', async () => {
    const req = await restrictedAdminReq(); // faculty=FICE
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ restrictions: [{ type: 'FACULTY', value: 'FICE' }] }),
    );
    prismaMock.$transaction.mockResolvedValueOnce([]);

    const res = await DELETE(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deletedId).toBe(MOCK_ELECTION_ID);
  });

  it('returns 200 when unrestricted admin deletes any election', async () => {
    const req = await adminReq(ADMIN_RECORD); // restricted_to_faculty=false
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.$transaction.mockResolvedValueOnce([]);

    const res = await DELETE(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('allows unrestricted admin to delete an open election', async () => {
    const req = await adminReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 3_600_000),
        closes_at: new Date(Date.now() + 3_600_000),
      }),
    );
    prismaMock.$transaction.mockResolvedValueOnce([]);

    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(200);
  });

  it('allows unrestricted admin to delete a closed election', async () => {
    const req = await adminReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
      }),
    );
    prismaMock.$transaction.mockResolvedValueOnce([]);

    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(200);
  });

  it('allows unrestricted admin to delete an upcoming election', async () => {
    const req = await adminReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() + 3_600_000),
        closes_at: new Date(Date.now() + 7_200_000),
      }),
    );
    prismaMock.$transaction.mockResolvedValueOnce([]);

    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(200);
  });

  it('invalidates the elections cache after deletion', async () => {
    const { invalidateElections } = jest.requireMock('@/lib/cache');
    const req = await adminReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.$transaction.mockResolvedValueOnce([]);

    await DELETE(req, PARAMS);

    expect(invalidateElections).toHaveBeenCalledTimes(1);
  });
});

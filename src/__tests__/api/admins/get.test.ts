import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, parseJson } from '../../helpers/request';
import {
  makeTokenPair,
  USER_PAYLOAD,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
} from '../../helpers/fixtures';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from '@/app/api/admins/[userId]/route';

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'GET' });
}

describe('GET /api/admins/[userId]', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Admins');
    allure.story('Get Admin');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);

    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

    const req = makeAuthRequest(access.token, { method: 'GET' });

    const res = await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(res.status).toBe(403);
  });

  it('returns 400 when userId param is missing', async () => {
    const req = await adminReq(ADMIN_RECORD);

    const res = await GET(req, { params: Promise.resolve({ userId: '' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when admin does not exist', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const res = await GET(req, { params: Promise.resolve({ userId: 'missing-admin' }) });

    expect(res.status).toBe(404);
  });

  it('returns 200 and the admin when found', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    const res = await GET(req, { params: Promise.resolve({ userId: ADMIN_RECORD.user_id }) });
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body).toEqual({
      ...ADMIN_RECORD,
      promoted_at: ADMIN_RECORD.promoted_at.toISOString(),
    });
  });

  it('calls prisma.admin.findUnique with the correct userId', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);

    await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(prismaMock.admin.findUnique).toHaveBeenLastCalledWith({
      where: { user_id: 'admin-002' },
    });
  });
});

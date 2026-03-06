import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, parseJson } from '../../helpers/request';
import {
  makeTokenPair,
  USER_PAYLOAD,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  RESTRICTED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
} from '../../helpers/fixtures';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/admins/invite/route';

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

async function adminReq(body: object, adminRecord: object = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

describe('POST /api/admins/invite', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Admins');
    allure.story('Create Invite Token');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by a non-admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin does not have manage_admins permission', async () => {
    const adminWithoutManage = { ...ADMIN_RECORD, manage_admins: false };
    const req = await adminReq({ validDue: FUTURE }, adminWithoutManage);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when validDue is missing', async () => {
    const req = await adminReq({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when validDue is in the past', async () => {
    const req = await adminReq({ validDue: new Date(Date.now() - 1000).toISOString() });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when maxUsage is 0', async () => {
    const req = await adminReq({ validDue: FUTURE, maxUsage: 0 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when maxUsage exceeds 100', async () => {
    const req = await adminReq({ validDue: FUTURE, maxUsage: 101 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 with a raw invite token for a valid request', async () => {
    const req = await adminReq({ validDue: FUTURE });
    prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(201);
    expect(typeof body.token).toBe('string');
    expect(body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(body.maxUsage).toBe(1);
    expect(body.manageAdmins).toBe(false);
  });

  it('forces restrictedToFaculty=true for faculty-restricted admin creators', async () => {
    const req = await adminReq(
      { validDue: FUTURE, restrictedToFaculty: false },
      RESTRICTED_ADMIN_RECORD,
    );
    prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

    await POST(req);

    expect(prismaMock.adminInviteToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ restricted_to_faculty: true }),
      }),
    );
  });

  it('stores the token hash, not the raw token, in the database', async () => {
    const req = await adminReq({ validDue: FUTURE });
    prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

    const res = await POST(req);
    const { body } = await parseJson<any>(res);

    const createData = prismaMock.adminInviteToken.create.mock.calls[0][0].data;
    expect(createData.token_hash).not.toBe(body.token);
    expect(createData.token_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('respects custom maxUsage and manageAdmins values', async () => {
    const req = await adminReq({ validDue: FUTURE, maxUsage: 10, manageAdmins: true });
    prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

    const res = await POST(req);
    const { body } = await parseJson<any>(res);

    expect(body.maxUsage).toBe(10);
    expect(body.manageAdmins).toBe(true);
  });
});

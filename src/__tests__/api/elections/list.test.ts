import * as allure from 'allure-js-commons';

import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  USER_PAYLOAD,
} from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from '@/app/api/admins/route';

describe('GET /api/admins', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Admins');
    allure.story('List Admins');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by a non-admin user', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when is_admin flag is set but no admin DB record exists', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with empty array when no admins exist', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([]);

    const req = makeAuthRequest(access.token);
    const { status, body } = await parseJson<any[]>(await GET(req));

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns a list of admins with correct fields', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([ADMIN_RECORD]);

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      user_id: ADMIN_RECORD.user_id,
      full_name: ADMIN_RECORD.full_name,
      manage_admins: true,
    });
  });
});

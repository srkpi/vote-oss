import * as allure from 'allure-js-commons';

import { JWT_TOKEN_RECORD, makeTokenPair, USER_PAYLOAD } from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);

const fetchFacultyGroupsMock = jest.fn<Promise<Record<string, string[]>>, []>();
jest.mock('@/lib/campus-api', () => ({
  fetchFacultyGroups: fetchFacultyGroupsMock,
}));

import { GET } from '@/app/api/campus/groups/route';

async function authReq() {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token);
}

const MOCK_GROUPS: Record<string, string[]> = {
  FICE: ['KV-11', 'KV-91'],
  FEL: ['EL-21'],
  'НН ФТІ': ['ФТ-51'],
};

describe('GET /api/campus/groups', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    fetchFacultyGroupsMock.mockReset().mockResolvedValue(MOCK_GROUPS);
    allure.feature('Campus API');
    allure.story('Groups Endpoint');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with faculty-groups map for authenticated user', async () => {
    const req = await authReq();
    const res = await GET(req);
    const { status, body } = await parseJson<Record<string, string[]>>(res);

    expect(status).toBe(200);
    expect(body['FICE']).toEqual(['KV-11', 'KV-91']);
    expect(body['FEL']).toEqual(['EL-21']);
  });

  it('delegates to fetchFacultyGroups', async () => {
    const req = await authReq();
    await GET(req);
    expect(fetchFacultyGroupsMock).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when campus API throws', async () => {
    fetchFacultyGroupsMock.mockRejectedValueOnce(new Error('campus down'));
    const req = await authReq();
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

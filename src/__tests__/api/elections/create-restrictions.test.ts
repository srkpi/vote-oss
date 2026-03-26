import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { campusMock, resetCampusMock } from '@/__tests__/helpers/campus-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  makeElection,
  makeTokenPair,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);
jest.mock('@/lib/campus-api', () => campusMock);

import { POST } from '@/app/api/elections/route';

const FUTURE_OPEN = new Date(Date.now() + 3_600_000).toISOString();
const FUTURE_CLOSE = new Date(Date.now() + 7_200_000).toISOString();

const validBody = {
  title: 'Test Election',
  opensAt: FUTURE_OPEN,
  closesAt: FUTURE_CLOSE,
  choices: ['Option A', 'Option B'],
};

async function makeAdminReq(body: object, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

function mockElectionCreate() {
  prismaMock.election.create.mockResolvedValueOnce({
    ...makeElection(),
    opens_at: new Date(FUTURE_OPEN),
    closes_at: new Date(FUTURE_CLOSE),
    restrictions: [],
  });
}

describe('POST /api/elections — restriction validation', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    resetCampusMock();
    allure.feature('Elections');
    allure.story('Create Election – Restriction Validation');
  });

  it('creates election without any restriction (campus API not called)', async () => {
    const req = await makeAdminReq({ ...validBody, restrictions: [] });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  it('creates election with FACULTY restriction after campus validation', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(campusMock.fetchFacultyGroups).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when restricted to a non-existent faculty', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'FACULTY', value: 'UNKNOWN_FACULTY' }],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/UNKNOWN_FACULTY/);
  });

  it('accepts multiple FACULTY restrictions (OR logic)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'FACULTY', value: 'FEL' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 400 when GROUP restriction without FACULTY restriction', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'GROUP', value: 'KV-91' }],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/GROUP.*FACULTY|FACULTY.*GROUP/i);
  });

  it('returns 400 when group not in any specified faculty', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FEL' },
        { type: 'GROUP', value: 'KV-91' }, // KV-91 is in FICE, not FEL
      ],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/KV-91/);
  });

  it('creates election with valid FACULTY + GROUP restrictions', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'GROUP', value: 'KV-91' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(campusMock.fetchFacultyGroups).toHaveBeenCalledTimes(1);
  });

  it('creates election with group spanning multiple faculties', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'FACULTY', value: 'FEL' },
        { type: 'GROUP', value: 'KV-91' }, // exists in FICE
        { type: 'GROUP', value: 'EL-21' }, // exists in FEL
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('accepts valid STUDY_YEAR restrictions', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'STUDY_YEAR', value: '3' }],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid study year', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'STUDY_YEAR', value: '8' }],
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('accepts valid STUDY_FORM restrictions', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'STUDY_FORM', value: 'FullTime' }],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 400 for invalid study form', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'STUDY_FORM', value: 'InvalidForm' }],
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('accepts combined FACULTY + STUDY_YEAR (AND logic)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'STUDY_YEAR', value: '3' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('forces FACULTY restriction for faculty-restricted admin', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq({ ...validBody, restrictions: [] }, restrictedAdmin);
    mockElectionCreate();
    await POST(req);

    const createData = prismaMock.election.create.mock.calls[0][0].data;
    expect(createData.restrictions.create).toContainEqual(
      expect.objectContaining({ type: 'FACULTY', value: 'FICE' }),
    );
  });

  it('returns 500 when campus API is unavailable during validation', async () => {
    campusMock.fetchFacultyGroups.mockRejectedValueOnce(new Error('campus down'));
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(500);
  });

  it('accepts НН faculty names as returned by the campus API', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'НН ФТІ' },
        { type: 'GROUP', value: 'ФТ-51' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '../../helpers/cache-mock';
import { campusMock, resetCampusMock } from '../../helpers/campus-mock';
import { ADMIN_PAYLOAD, ADMIN_RECORD, makeElection, makeTokenPair } from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

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

describe('POST /api/elections — faculty/group validation', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    resetCampusMock();
    allure.feature('Elections');
    allure.story('Create Election – Faculty/Group Validation');
  });

  // ── No restrictions ───────────────────────────────────────────────────────

  it('creates election without any restriction', async () => {
    const req = await makeAdminReq(validBody);
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection(),
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    // Campus API should NOT be queried when no restrictions are applied
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  // ── Faculty restriction ───────────────────────────────────────────────────

  it('returns 400 when restricted to a non-existent faculty', async () => {
    const req = await makeAdminReq({ ...validBody, restrictedToFaculty: 'UNKNOWN_FACULTY' });
    const { status, body } = await parseJson<any>(await POST(req));

    expect(status).toBe(400);
    expect(body.message).toMatch(/UNKNOWN_FACULTY/);
    expect(campusMock.fetchFacultyGroups).toHaveBeenCalled();
  });

  it('returns 201 when restricted to an existing faculty', async () => {
    const req = await makeAdminReq({ ...validBody, restrictedToFaculty: 'FICE' });
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection({ restricted_to_faculty: 'FICE' }),
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('validates campus API once when both faculty and group are provided', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictedToFaculty: 'FICE',
      restrictedToGroup: 'KV-91',
    });
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection({ restricted_to_faculty: 'FICE', restricted_to_group: 'KV-91' }),
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    // fetchFacultyGroups should only be called once
    expect(campusMock.fetchFacultyGroups).toHaveBeenCalledTimes(1);
  });

  // ── Group restriction ─────────────────────────────────────────────────────

  it('returns 400 when group is specified without faculty', async () => {
    const req = await makeAdminReq({ ...validBody, restrictedToGroup: 'KV-91' });
    const { status, body } = await parseJson<any>(await POST(req));

    expect(status).toBe(400);
    expect(body.message).toMatch(/restrictedToFaculty/);
  });

  it('returns 400 when restricted to a group that does not exist in the given faculty', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictedToFaculty: 'FICE',
      restrictedToGroup: 'EL-99', // EL groups are in FEL, not FICE
    });
    const { status, body } = await parseJson<any>(await POST(req));

    expect(status).toBe(400);
    expect(body.message).toMatch(/EL-99/);
  });

  it('returns 201 when restricted to a valid faculty+group pair', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictedToFaculty: 'FEL',
      restrictedToGroup: 'EL-21',
    });
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection({ restricted_to_faculty: 'FEL', restricted_to_group: 'EL-21' }),
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 400 when group belongs to a different faculty', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictedToFaculty: 'FICE',
      restrictedToGroup: 'EL-21', // EL-21 is in FEL, not FICE
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  // ── Admin faculty restriction enforcement ─────────────────────────────────

  it('forces faculty-restricted admin elections to use their faculty and validates it', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      { ...validBody, restrictedToFaculty: null }, // tries to create unrestricted
      restrictedAdmin,
    );
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection({ restricted_to_faculty: 'FICE' }),
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    // Should be validated against campus API
    expect(campusMock.fetchFacultyGroups).toHaveBeenCalled();

    // restricted_to_faculty must be set to admin's faculty
    const createData = prismaMock.election.create.mock.calls[0][0].data;
    expect(createData.restricted_to_faculty).toBe('FICE');
  });

  it('returns 400 when campus API reports admin faculty as invalid', async () => {
    // Simulate a campus API that no longer has the admin's faculty
    campusMock.fetchFacultyGroups.mockResolvedValueOnce({ FEL: ['EL-21'] }); // FICE missing
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(validBody, restrictedAdmin);

    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  // ── Campus API failure ────────────────────────────────────────────────────

  it('returns 500 when campus API is unavailable during validation', async () => {
    campusMock.fetchFacultyGroups.mockRejectedValueOnce(new Error('campus down'));
    const req = await makeAdminReq({ ...validBody, restrictedToFaculty: 'FICE' });

    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(500);
  });

  // ── НН faculty names ──────────────────────────────────────────────────────

  it('accepts НН faculty names as returned by the campus API', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictedToFaculty: 'НН ФТІ',
      restrictedToGroup: 'ФТ-51',
    });
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection({ restricted_to_faculty: 'НН ФТІ', restricted_to_group: 'ФТ-51' }),
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  // ── Error message quality ─────────────────────────────────────────────────

  it('includes the faculty name in the error message for unknown faculty', async () => {
    const req = await makeAdminReq({ ...validBody, restrictedToFaculty: 'GHOST' });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toContain('GHOST');
  });

  it('includes the group name in the error message for unknown group', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictedToFaculty: 'FICE',
      restrictedToGroup: 'XX-99',
    });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toContain('XX-99');
  });
});

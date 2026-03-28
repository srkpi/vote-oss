import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { campusMock, MOCK_FACULTY_GROUPS, resetCampusMock } from '@/__tests__/helpers/campus-mock';
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
import {
  LEVEL_COURSE_BACHELOR_COURSES,
  LEVEL_COURSE_GRADUATE_COURSES,
  LEVEL_COURSE_MASTER_COURSES,
} from '@/lib/constants';

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

  // ── Existing restriction tests ───────────────────────────────────────────

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
    campusMock.fetchFacultyGroups.mockResolvedValueOnce({
      FEL: ['EL-91'],
      FICE: ['KV-91'],
    });

    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FEL' },
        { type: 'GROUP', value: 'EL-91' },
        { type: 'GROUP', value: 'KV-91' },
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
        { type: 'GROUP', value: 'KV-91' },
        { type: 'GROUP', value: 'EL-21' },
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

  // ── Faculty-restricted admin enforcement ─────────────────────────────────

  it('creates election when restricted admin provides correct FACULTY restriction', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      {
        ...validBody,
        restrictions: [{ type: 'FACULTY', value: 'FICE' }],
      },
      restrictedAdmin,
    );
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('stores exactly the restrictions sent by a restricted admin (no auto-append)', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      {
        ...validBody,
        restrictions: [{ type: 'FACULTY', value: 'FICE' }],
      },
      restrictedAdmin,
    );
    mockElectionCreate();
    await POST(req);

    const createData = prismaMock.election.create.mock.calls[0][0].data;
    const facultyRestrictions = createData.restrictions.create.filter(
      (r: { type: string }) => r.type === 'FACULTY',
    );
    expect(facultyRestrictions).toHaveLength(1);
    expect(facultyRestrictions[0].value).toBe('FICE');
  });

  it('returns 400 when faculty-restricted admin omits FACULTY restriction', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq({ ...validBody, restrictions: [] }, restrictedAdmin);
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/FICE/);
  });

  it('returns 400 when faculty-restricted admin targets a different faculty', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      {
        ...validBody,
        restrictions: [{ type: 'FACULTY', value: 'FEL' }],
      },
      restrictedAdmin,
    );
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/FICE/);
  });

  it('returns 400 when faculty-restricted admin includes their own faculty plus another', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      {
        ...validBody,
        restrictions: [
          { type: 'FACULTY', value: 'FICE' },
          { type: 'FACULTY', value: 'FEL' },
        ],
      },
      restrictedAdmin,
    );
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/FICE/);
  });

  it('returns 400 when faculty-restricted admin sends no restrictions at all', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    // omit restrictions key entirely
    const req = await makeAdminReq({ ...validBody }, restrictedAdmin);
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('allows faculty-restricted admin to add GROUP restriction within their faculty', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      {
        ...validBody,
        restrictions: [
          { type: 'FACULTY', value: 'FICE' },
          { type: 'GROUP', value: 'KV-91' },
        ],
      },
      restrictedAdmin,
    );
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('allows faculty-restricted admin to combine their FACULTY restriction with STUDY_FORM', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      {
        ...validBody,
        restrictions: [
          { type: 'FACULTY', value: 'FICE' },
          { type: 'STUDY_FORM', value: 'FullTime' },
        ],
      },
      restrictedAdmin,
    );
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('allows faculty-restricted admin to combine their FACULTY restriction with LEVEL_COURSE', async () => {
    const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
    const req = await makeAdminReq(
      {
        ...validBody,
        restrictions: [
          { type: 'FACULTY', value: 'FICE' },
          { type: 'LEVEL_COURSE', value: 'b2' },
        ],
      },
      restrictedAdmin,
    );
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  // ── LEVEL_COURSE restriction tests ───────────────────────────────────────

  it('creates election with a valid bachelor LEVEL_COURSE restriction', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'b1' }],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  it('accepts all valid bachelor courses', async () => {
    for (const course of LEVEL_COURSE_BACHELOR_COURSES) {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: `b${course}` }],
      });
      mockElectionCreate();
      const res = await POST(req);
      expect(res.status).toBe(201);
    }
  });

  it('accepts all valid master courses', async () => {
    for (const course of LEVEL_COURSE_MASTER_COURSES) {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: `m${course}` }],
      });
      mockElectionCreate();
      const res = await POST(req);
      expect(res.status).toBe(201);
    }
  });

  it('returns 400 for a completely invalid LEVEL_COURSE value', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'x9' }],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/x9/);
  });

  it('returns 400 for bachelor course out of range (b6)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'b6' }],
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('returns 400 for master course out of range (m4)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'm4' }],
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('returns 400 for graduate course out of range (g5)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'g5' }],
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('accepts multiple LEVEL_COURSE values (OR logic within type)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'LEVEL_COURSE', value: 'b1' },
        { type: 'LEVEL_COURSE', value: 'b2' },
        { type: 'LEVEL_COURSE', value: 'm1' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('accepts LEVEL_COURSE combined with FACULTY (AND logic)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'LEVEL_COURSE', value: 'b2' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(campusMock.fetchFacultyGroups).toHaveBeenCalledTimes(1);
  });

  it('accepts LEVEL_COURSE combined with STUDY_FORM (AND logic)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'STUDY_FORM', value: 'FullTime' },
        { type: 'LEVEL_COURSE', value: 'b3' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty string LEVEL_COURSE value', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: '' }],
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('includes valid values in the error message for invalid LEVEL_COURSE', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'z1' }],
    });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(/b1/);
  });

  it('does not call campus API for elections with only LEVEL_COURSE restrictions', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'LEVEL_COURSE', value: 'b1' },
        { type: 'LEVEL_COURSE', value: 'm2' },
      ],
    });
    mockElectionCreate();
    await POST(req);
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  // ── Graduate LEVEL_COURSE restriction (blocked) ──────────────────────────

  it('returns 400 for all graduate LEVEL_COURSE values (g prefix)', async () => {
    for (const course of LEVEL_COURSE_GRADUATE_COURSES) {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: `g${course}` }],
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/graduate/i);
    }
  });

  it('returns 400 for a valid graduate course value (g1)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'g1' }],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/graduate/i);
  });

  it('returns 400 when mixing valid non-graduate and graduate LEVEL_COURSE values', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'LEVEL_COURSE', value: 'b1' },
        { type: 'LEVEL_COURSE', value: 'g1' }, // this should cause 400
      ],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/graduate/i);
  });

  it('does not call campus API when graduate LEVEL_COURSE is rejected', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [{ type: 'LEVEL_COURSE', value: 'g2' }],
    });
    await POST(req);
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  // ── Graduate GROUP restriction (blocked) ─────────────────────────────────

  it('returns 400 when GROUP restriction contains a graduate group', async () => {
    // Add a graduate group to the campus mock for this test
    campusMock.fetchFacultyGroups.mockResolvedValueOnce({
      ...MOCK_FACULTY_GROUPS,
      FICE: [...(MOCK_FACULTY_GROUPS.FICE ?? []), 'KV-11ф'],
    });

    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'GROUP', value: 'KV-11ф' },
      ],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/graduate/i);
  });

  it('error message for graduate GROUP includes the group name', async () => {
    campusMock.fetchFacultyGroups.mockResolvedValueOnce({
      ...MOCK_FACULTY_GROUPS,
      FICE: [...(MOCK_FACULTY_GROUPS.FICE ?? []), 'KV-11ф'],
    });

    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'GROUP', value: 'KV-11ф' },
      ],
    });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(/KV-11ф/);
  });

  it('returns 400 for any group with ф suffix regardless of faculty', async () => {
    campusMock.fetchFacultyGroups.mockResolvedValueOnce({
      ...MOCK_FACULTY_GROUPS,
      FEL: [...(MOCK_FACULTY_GROUPS.FEL ?? []), 'EL-11ф'],
    });

    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FEL' },
        { type: 'GROUP', value: 'EL-11ф' },
      ],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/graduate/i);
  });

  it('still accepts non-graduate groups after the graduate check is in place', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'GROUP', value: 'KV-91' }, // bachelor group, not graduate
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('still accepts master groups as GROUP restrictions', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'НН ІМЗ' },
        { type: 'GROUP', value: 'ІМ-41мн' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 400 when a selected faculty has no corresponding selected groups', async () => {
    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'FACULTY', value: 'FEL' },
        { type: 'GROUP', value: 'KV-91' }, // KV-91 belongs to FICE, making FEL redundant
      ],
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/Redundant faculty restrictions.*FEL/i);
  });

  it('creates election with a shared group spanning multiple faculties without triggering redundant error', async () => {
    campusMock.fetchFacultyGroups.mockResolvedValueOnce({
      ...MOCK_FACULTY_GROUPS,
      FICE: [...(MOCK_FACULTY_GROUPS.FICE ?? []), 'SHARED-11'],
      FEL: [...(MOCK_FACULTY_GROUPS.FEL ?? []), 'SHARED-11'],
    });

    const req = await makeAdminReq({
      ...validBody,
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'FACULTY', value: 'FEL' },
        { type: 'GROUP', value: 'SHARED-11' },
      ],
    });
    mockElectionCreate();
    const res = await POST(req);
    expect(res.status).toBe(201); // Both FICE and FEL contain SHARED-11, so neither is redundant
  });
});

import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { campusMock, MOCK_FACULTY_GROUPS, resetCampusMock } from '@/__tests__/helpers/campus-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  makeElection,
  makeTokenPair,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
vi.mock('@/lib/cache', async () => {
  const { cacheMock } = await import('@/__tests__/helpers/cache-mock');
  return cacheMock;
});
vi.mock('@/lib/campus-api', async () => {
  const { campusMock } = await import('@/__tests__/helpers/campus-mock');
  return campusMock;
});
vi.mock('@/lib/encryption', () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));

import { POST } from '@/app/api/elections/route';
import {
  LEVEL_COURSE_BACHELOR_COURSES,
  LEVEL_COURSE_GRADUATE_COURSES,
  LEVEL_COURSE_MASTER_COURSES,
} from '@/lib/constants';

const FUTURE_OPEN = new Date(TEST_NOW + 3_600_000).toISOString();
const FUTURE_CLOSE = new Date(TEST_NOW + 7_200_000).toISOString();

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

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
  resetCampusMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Creating an election — restriction validation (POST /api/elections)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Create Election – Restriction Validation');
  });

  // ── Existing restriction tests ───────────────────────────────────────────

  describe('when defining voter eligibility', () => {
    it('should create election without any restriction (campus API not called) when creating an election', async () => {
      const req = await makeAdminReq({ ...validBody, restrictions: [] });
      mockElectionCreate();
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
    });

    it('should create election with FACULTY restriction after campus validation', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'FACULTY', value: 'FICE' }],
      });
      mockElectionCreate();
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(campusMock.fetchFacultyGroups).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when restricted to a non-existent faculty', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'FACULTY', value: 'UNKNOWN_FACULTY' }],
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/UNKNOWN_FACULTY/);
    });

    it('should accept multiple FACULTY restrictions (OR logic) when creating an election', async () => {
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

    it('should return 400 when GROUP restriction without FACULTY restriction', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'GROUP', value: 'KV-91' }],
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/GROUP.*FACULTY|FACULTY.*GROUP/i);
    });

    it('should return 400 when group not in any specified faculty', async () => {
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

    it('should create election with valid FACULTY + GROUP restrictions when creating an election', async () => {
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

    it('should create election with group spanning multiple faculties when creating an election', async () => {
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

    it('should accept valid STUDY_YEAR restrictions when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'STUDY_YEAR', value: '3' }],
      });
      mockElectionCreate();
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid study year when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'STUDY_YEAR', value: '8' }],
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should accept valid STUDY_FORM restrictions when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'STUDY_FORM', value: 'FullTime' }],
      });
      mockElectionCreate();
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it('should return 400 for invalid study form when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'STUDY_FORM', value: 'InvalidForm' }],
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should accept combined FACULTY + STUDY_YEAR (AND logic) when creating an election', async () => {
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

    it('should return 500 when campus API is unavailable during validation', async () => {
      campusMock.fetchFacultyGroups.mockRejectedValueOnce(new Error('campus down'));
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'FACULTY', value: 'FICE' }],
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(500);
    });

    it('should accept НН faculty names as returned by the campus API when creating an election', async () => {
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

  // ── Faculty-restricted admin enforcement ─────────────────────────────────

  describe('when a faculty-limited admin defines voter eligibility', () => {
    it('should create an election when a faculty-limited admin restricts it to their own faculty', async () => {
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

    it('should preserve submitted restrictions when a faculty-limited admin creates an election', async () => {
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

    it('should return 400 when faculty-restricted admin omits FACULTY restriction', async () => {
      const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
      const req = await makeAdminReq({ ...validBody, restrictions: [] }, restrictedAdmin);
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/FICE/);
    });

    it('should return 400 when faculty-restricted admin targets a different faculty', async () => {
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

    it('should return 400 when faculty-restricted admin includes their own faculty plus another', async () => {
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

    it('should return 400 when faculty-restricted admin sends no restrictions at all', async () => {
      const restrictedAdmin = { ...ADMIN_RECORD, restricted_to_faculty: true, faculty: 'FICE' };
      // omit restrictions key entirely
      const req = await makeAdminReq({ ...validBody }, restrictedAdmin);
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should allow faculty-restricted admin to add GROUP restriction within their faculty when creating an election', async () => {
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

    it('should allow faculty-restricted admin to combine their FACULTY restriction with STUDY_FORM when creating an election', async () => {
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

    it('should allow faculty-restricted admin to combine their FACULTY restriction with LEVEL_COURSE when creating an election', async () => {
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
  });

  // ── LEVEL_COURSE restriction tests ───────────────────────────────────────

  describe('when restricting eligibility by degree and course', () => {
    it('should create election with a valid bachelor LEVEL_COURSE restriction when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'b1' }],
      });
      mockElectionCreate();
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
    });

    it.each(LEVEL_COURSE_BACHELOR_COURSES)(
      'should accept bachelor LEVEL_COURSE b%s when creating an election',
      async (course) => {
        const req = await makeAdminReq({
          ...validBody,
          restrictions: [{ type: 'LEVEL_COURSE', value: `b${course}` }],
        });
        mockElectionCreate();
        const res = await POST(req);
        expect(res.status).toBe(201);
      },
    );

    it.each(LEVEL_COURSE_MASTER_COURSES)(
      'should accept master LEVEL_COURSE m%s when creating an election',
      async (course) => {
        const req = await makeAdminReq({
          ...validBody,
          restrictions: [{ type: 'LEVEL_COURSE', value: `m${course}` }],
        });
        mockElectionCreate();
        const res = await POST(req);
        expect(res.status).toBe(201);
      },
    );

    it('should return 400 for a completely invalid LEVEL_COURSE value when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'x9' }],
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/x9/);
    });

    it('should return 400 for bachelor course out of range (b6) when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'b6' }],
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should return 400 for master course out of range (m4) when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'm4' }],
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should return 400 for graduate course out of range (g5) when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'g5' }],
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should accept multiple LEVEL_COURSE values (OR logic within type) when creating an election', async () => {
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

    it('should accept LEVEL_COURSE combined with FACULTY (AND logic) when creating an election', async () => {
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

    it('should accept LEVEL_COURSE combined with STUDY_FORM (AND logic) when creating an election', async () => {
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

    it('should return 400 for an empty string LEVEL_COURSE value when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: '' }],
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should include valid values in the error message for invalid LEVEL_COURSE when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'z1' }],
      });
      const { body } = await parseJson<any>(await POST(req));
      expect(body.message).toMatch(/b1/);
    });

    it('should not call campus API for elections with only LEVEL_COURSE restrictions when creating an election', async () => {
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
  });

  // ── Graduate LEVEL_COURSE restriction (blocked) ──────────────────────────

  describe('when a degree restriction includes graduates', () => {
    it.each(LEVEL_COURSE_GRADUATE_COURSES)(
      'should reject graduate LEVEL_COURSE g%s when creating an election',
      async (course) => {
        const req = await makeAdminReq({
          ...validBody,
          restrictions: [{ type: 'LEVEL_COURSE', value: `g${course}` }],
        });
        const { status, body } = await parseJson<any>(await POST(req));
        expect(status).toBe(400);
        expect(body.message).toMatch(/graduate/i);
      },
    );

    it('should return 400 for a valid graduate course value (g1) when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'g1' }],
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/graduate/i);
    });

    it('should return 400 when mixing valid non-graduate and graduate LEVEL_COURSE values', async () => {
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

    it('should not call campus API when graduate LEVEL_COURSE is rejected', async () => {
      const req = await makeAdminReq({
        ...validBody,
        restrictions: [{ type: 'LEVEL_COURSE', value: 'g2' }],
      });
      await POST(req);
      expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
    });
  });

  // ── Graduate GROUP restriction (blocked) ─────────────────────────────────

  describe('when a group restriction includes graduates', () => {
    it('should return 400 when GROUP restriction contains a graduate group', async () => {
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

    it('should identify the graduate group in the error when rejecting its eligibility restriction', async () => {
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

    it('should return 400 for any group with ф suffix regardless of faculty when creating an election', async () => {
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

    it('should accept ordinary student groups when validating group eligibility', async () => {
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

    it('should accept master student groups when validating group eligibility', async () => {
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

    it('should return 400 when a selected faculty has no corresponding selected groups', async () => {
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

    it('should accept a shared group when it covers every selected faculty', async () => {
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
});

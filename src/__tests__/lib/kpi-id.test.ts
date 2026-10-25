import * as allure from 'allure-js-commons';
import { NextResponse } from 'next/server';
import { vi, describe, expect, beforeEach, afterEach, it } from 'vitest';

import { TEST_NOW } from '@/__tests__/helpers/time';
import { getUserBypassInfo } from '@/lib/bypass';
import { fetchFacultyGroups } from '@/lib/campus-api';
import { ALLOWED_AUTH_METHODS } from '@/lib/constants';
import {
  getCampusUserData,
  GraduateUserError,
  InvalidTicketError,
  NotAllowedAuthMethodError,
  NotStudentError,
  NotStudyingError,
  resolveFacultyShortName,
  resolveTicket,
  resolveUserData,
} from '@/lib/kpi-id';
import type { KpiIdUserInfo } from '@/types/auth';

vi.mock('@/lib/campus-api', () => ({
  fetchFacultyGroups: vi.fn(),
}));

vi.mock('@/lib/bypass', () => ({
  getUserBypassInfo: vi.fn(),
}));

const DEFAULT_CAMPUS_RESPONSE = {
  groupName: 'IP-24',
  faculty: 'TEST Faculty',
  status: 'Studying',
  studyForm: 'Денна',
  studyYear: 1,
  speciality: '121',
};

const DEFAULT_FACULTY_GROUPS: Record<string, string[]> = {
  TEST: ['IP-24'],
};

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Student sign-in eligibility', () => {
  beforeEach(() => {
    allure.feature('KPI ID Auth Logic');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    vi.mocked(fetchFacultyGroups).mockResolvedValue(DEFAULT_FACULTY_GROUPS);
    vi.mocked(getUserBypassInfo).mockResolvedValue({ global: null, elections: {} });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Validating a KPI-ID ticket', () => {
    it('should return the student identity when the provider accepts the sign-in ticket', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          data: { AUTH_METHOD: ALLOWED_AUTH_METHODS[0], STUDENT_ID: 'user-123', NAME: 'Ivan' },
        }),
      );

      const user = await resolveTicket('valid-ticket');
      expect(user).toMatchObject({
        STUDENT_ID: 'user-123',
        NAME: 'Ivan',
        AUTH_METHOD: ALLOWED_AUTH_METHODS[0],
      });
    });

    it('should reject the sign-in ticket with InvalidTicketError when the provider rejects it', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
      await expect(resolveTicket('bad-ticket')).rejects.toThrow(InvalidTicketError);
    });

    it('should reject sign-in with NotAllowedAuthMethodError when the authentication method is not permitted', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          data: { AUTH_METHOD: 'WRONG', STUDENT_ID: 'student-123', NAME: 'Petro' },
        }),
      );
      await expect(resolveTicket('ticket')).rejects.toThrow(NotAllowedAuthMethodError);
    });

    it('should reject sign-in with NotStudentError when the identity belongs only to an employee', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          data: { AUTH_METHOD: ALLOWED_AUTH_METHODS[0], EMPLOYEE_ID: 'emp-123', NAME: 'Petro' },
        }),
      );
      await expect(resolveTicket('ticket')).rejects.toThrow(NotStudentError);
    });
  });

  describe('Checking student eligibility', () => {
    const mockKpiData: KpiIdUserInfo = {
      AUTH_METHOD: ALLOWED_AUTH_METHODS[0],
      STUDENT_ID: 'user-123',
      NAME: 'Ivan',
      EMPLOYEE_ID: '',
      TAX_ID: '1234',
      TRACE_ID: 'some-trace',
      TIME_STAMP: '0000',
    };

    it('should return data and empty errors array for active student when checking student eligibility', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(DEFAULT_CAMPUS_RESPONSE));

      const result = await resolveUserData(mockKpiData);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toMatchObject({ userId: 'user-123', group: 'IP-24' });
    });

    it('should include NotStudyingError when status is not Studying', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...DEFAULT_CAMPUS_RESPONSE, status: 'Dismissed' }),
      );

      const result = await resolveUserData(mockKpiData);
      expect(result.errors.some((e) => e instanceof NotStudyingError)).toBe(true);
    });

    it('should include GraduateUserError when group ends with graduate suffix (e.g., ф)', async () => {
      vi.mocked(fetchFacultyGroups).mockResolvedValue({ TEST: ['FT-51ф'] });
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...DEFAULT_CAMPUS_RESPONSE, groupName: 'FT-51ф' }),
      );

      const result = await resolveUserData(mockKpiData);
      expect(result.errors.some((e) => e instanceof GraduateUserError)).toBe(true);
    });

    it('should report both eligibility failures when the student has graduated and is no longer studying', async () => {
      vi.mocked(fetchFacultyGroups).mockResolvedValue({ TEST: ['FT-51ф'] });
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...DEFAULT_CAMPUS_RESPONSE,
          groupName: 'FT-51ф',
          status: 'Dismissed',
        }),
      );

      const result = await resolveUserData(mockKpiData);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('Checking eligibility for sign-in', () => {
    const mockKpiData: KpiIdUserInfo = {
      AUTH_METHOD: ALLOWED_AUTH_METHODS[0],
      STUDENT_ID: 'user-123',
      NAME: 'Ivan',
      EMPLOYEE_ID: '',
      TAX_ID: '1234',
      TRACE_ID: 'some-trace',
      TIME_STAMP: '0000',
    };

    it('should return the student profile when all sign-in eligibility checks pass', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(DEFAULT_CAMPUS_RESPONSE));

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
      expect((res as any).userId).toBe('user-123');
    });

    it('should allow sign-in when the student is on academic leave', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...DEFAULT_CAMPUS_RESPONSE, status: 'OnAcademicLeave' }),
      );

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
      expect((res as any).userId).toBe('user-123');
    });

    it('should return 403 Forbidden for NotStudyingError when no bypass exists', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...DEFAULT_CAMPUS_RESPONSE, status: 'Dismissed' }),
      );

      const res = (await getCampusUserData(mockKpiData)) as NextResponse;
      expect(res.status).toBe(403);
    });

    it('should allow sign-in when an active bypass covers the non-studying status', async () => {
      vi.mocked(getUserBypassInfo).mockResolvedValue({
        global: {
          bypassNotStudying: true,
          bypassGraduate: false,
          validUntil: TEST_NOW + 86_400_000,
        },
        elections: {},
      });
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...DEFAULT_CAMPUS_RESPONSE, status: 'Dismissed' }),
      );

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
    });

    it('should return 403 Forbidden for GraduateUserError when no bypass exists', async () => {
      vi.mocked(fetchFacultyGroups).mockResolvedValue({ TEST: ['FT-51ф'] });
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...DEFAULT_CAMPUS_RESPONSE, groupName: 'FT-51ф' }),
      );

      const res = (await getCampusUserData(mockKpiData)) as NextResponse;
      expect(res.status).toBe(403);
    });

    it('should allow sign-in when an active bypass covers graduate status', async () => {
      vi.mocked(getUserBypassInfo).mockResolvedValue({
        global: {
          bypassNotStudying: false,
          bypassGraduate: true,
          validUntil: TEST_NOW + 86_400_000,
        },
        elections: {},
      });
      vi.mocked(fetchFacultyGroups).mockResolvedValue({ TEST: ['FT-51ф'] });
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ ...DEFAULT_CAMPUS_RESPONSE, groupName: 'FT-51ф' }),
      );

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
    });

    it('should deny sign-in when one of two eligibility failures has no bypass', async () => {
      vi.mocked(getUserBypassInfo).mockResolvedValue({
        global: {
          bypassNotStudying: false,
          bypassGraduate: true,
          validUntil: TEST_NOW + 86_400_000,
        },
        elections: {},
      });
      vi.mocked(fetchFacultyGroups).mockResolvedValue({ TEST: ['FT-51ф'] });
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({
          ...DEFAULT_CAMPUS_RESPONSE,
          groupName: 'FT-51ф',
          status: 'Dismissed',
        }),
      );

      const res = (await getCampusUserData(mockKpiData)) as NextResponse;
      expect(res.status).toBe(403);
    });
  });

  describe('Matching a faculty name', () => {
    it('should select the closest faculty name when multiple faculties contain the student group', () => {
      const map = { ФІОТ: ['IP-24'], ФТІ: ['IP-24'] };
      expect(
        resolveFacultyShortName('Факультет інформатики та обчислювальної техніки', 'IP-24', map),
      ).toBe('ФІОТ');
    });
  });
});

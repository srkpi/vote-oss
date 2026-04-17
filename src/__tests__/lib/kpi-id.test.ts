import * as allure from 'allure-js-commons';
import { NextResponse } from 'next/server';

import { getUserBypassInfo } from '@/lib/bypass';
import { fetchFacultyGroups } from '@/lib/campus-api';
import {
  getCampusUserData,
  GraduateUserError,
  InvalidTicketError,
  NotDiiaAuthError,
  NotStudentError,
  NotStudyingError,
  resolveFacultyShortName,
  resolveTicket,
  resolveUserData,
} from '@/lib/kpi-id';
import type { KpiIdUserInfo } from '@/types/auth';

jest.mock('@/lib/campus-api', () => ({
  fetchFacultyGroups: jest.fn(),
}));

jest.mock('@/lib/bypass', () => ({
  getUserBypassInfo: jest.fn(),
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

describe('kpi-id module', () => {
  beforeEach(() => {
    allure.feature('KPI ID Auth Logic');
    global.fetch = jest.fn();
    (fetchFacultyGroups as jest.Mock).mockResolvedValue(DEFAULT_FACULTY_GROUPS);
    (getUserBypassInfo as jest.Mock).mockResolvedValue({ global: {} });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('resolveTicket', () => {
    it('returns parsed user info on successful response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'user-123', NAME: 'Ivan' },
        }),
      });

      const user = await resolveTicket('valid-ticket');
      expect(user).toMatchObject({ STUDENT_ID: 'user-123', NAME: 'Ivan', AUTH_METHOD: 'DIIA' });
    });

    it('throws InvalidTicketError if response is not ok', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(resolveTicket('bad-ticket')).rejects.toThrow(InvalidTicketError);
    });

    it('throws NotDiiaAuthError if AUTH_METHOD is not DIIA', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { AUTH_METHOD: 'APP', STUDENT_ID: 'student-123', NAME: 'Petro' },
        }),
      });
      await expect(resolveTicket('ticket')).rejects.toThrow(NotDiiaAuthError);
    });

    it('throws NotStudentError if only EMPLOYEE_ID is present', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { AUTH_METHOD: 'DIIA', EMPLOYEE_ID: 'emp-123', NAME: 'Petro' },
        }),
      });
      await expect(resolveTicket('ticket')).rejects.toThrow(NotStudentError);
    });
  });

  describe('resolveUserData', () => {
    const mockKpiData: KpiIdUserInfo = {
      AUTH_METHOD: 'DIIA',
      STUDENT_ID: 'user-123',
      NAME: 'Ivan',
      EMPLOYEE_ID: '',
      TAX_ID: '1234',
      TRACE_ID: 'some-trace',
      TIME_STAMP: '0000',
    };

    it('returns data and empty errors array for active student', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_CAMPUS_RESPONSE,
      });

      const result = await resolveUserData(mockKpiData);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toMatchObject({ userId: 'user-123', group: 'IP-24' });
    });

    it('includes NotStudyingError if status is not Studying', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_CAMPUS_RESPONSE, status: 'Dismissed' }),
      });

      const result = await resolveUserData(mockKpiData);
      expect(result.errors.some((e) => e instanceof NotStudyingError)).toBe(true);
    });

    it('includes GraduateUserError if group ends with graduate suffix (e.g., ф)', async () => {
      (fetchFacultyGroups as jest.Mock).mockResolvedValue({ TEST: ['FT-51ф'] });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_CAMPUS_RESPONSE, groupName: 'FT-51ф' }),
      });

      const result = await resolveUserData(mockKpiData);
      expect(result.errors.some((e) => e instanceof GraduateUserError)).toBe(true);
    });

    it('can accumulate multiple errors (NotStudying AND Graduate)', async () => {
      (fetchFacultyGroups as jest.Mock).mockResolvedValue({ TEST: ['FT-51ф'] });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...DEFAULT_CAMPUS_RESPONSE,
          groupName: 'FT-51ф',
          status: 'Dismissed',
        }),
      });

      const result = await resolveUserData(mockKpiData);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getCampusUserData & Bypasses', () => {
    const mockKpiData: KpiIdUserInfo = {
      AUTH_METHOD: 'DIIA',
      STUDENT_ID: 'user-123',
      NAME: 'Ivan',
      EMPLOYEE_ID: '',
      TAX_ID: '1234',
      TRACE_ID: 'some-trace',
      TIME_STAMP: '0000',
    };

    it('returns UserInfo on success', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_CAMPUS_RESPONSE,
      });

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
      expect((res as any).userId).toBe('user-123');
    });

    it('success for students on academic leave', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_CAMPUS_RESPONSE, status: 'OnAcademicLeave' }),
      });

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
      expect((res as any).userId).toBe('user-123');
    });

    it('returns 403 Forbidden for NotStudyingError if no bypass exists', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_CAMPUS_RESPONSE, status: 'Dismissed' }),
      });

      const res = (await getCampusUserData(mockKpiData)) as NextResponse;
      expect(res.status).toBe(403);
    });

    it('bypasses NotStudyingError if bypassNotStudying is true', async () => {
      (getUserBypassInfo as jest.Mock).mockResolvedValue({ global: { bypassNotStudying: true } });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_CAMPUS_RESPONSE, status: 'Dismissed' }),
      });

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
    });

    it('returns 403 Forbidden for GraduateUserError if no bypass exists', async () => {
      (fetchFacultyGroups as jest.Mock).mockResolvedValue({ TEST: ['FT-51ф'] });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_CAMPUS_RESPONSE, groupName: 'FT-51ф' }),
      });

      const res = (await getCampusUserData(mockKpiData)) as NextResponse;
      expect(res.status).toBe(403);
    });

    it('bypasses GraduateUserError if bypassGraduate is true', async () => {
      (getUserBypassInfo as jest.Mock).mockResolvedValue({ global: { bypassGraduate: true } });
      (fetchFacultyGroups as jest.Mock).mockResolvedValue({ TEST: ['FT-51ф'] });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_CAMPUS_RESPONSE, groupName: 'FT-51ф' }),
      });

      const res = await getCampusUserData(mockKpiData);
      expect(res).not.toBeInstanceOf(NextResponse);
    });

    it('fails if user has both errors but only one is bypassed', async () => {
      (getUserBypassInfo as jest.Mock).mockResolvedValue({ global: { bypassGraduate: true } });
      (fetchFacultyGroups as jest.Mock).mockResolvedValue({ TEST: ['FT-51ф'] });
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...DEFAULT_CAMPUS_RESPONSE,
          groupName: 'FT-51ф',
          status: 'Dismissed',
        }),
      });

      const res = (await getCampusUserData(mockKpiData)) as NextResponse;
      expect(res.status).toBe(403);
    });
  });

  describe('resolveFacultyShortName', () => {
    it('uses Levenshtein to pick the best short key', () => {
      const map = { ФІОТ: ['IP-24'], ФТІ: ['IP-24'] };
      expect(
        resolveFacultyShortName('Факультет інформатики та обчислювальної техніки', 'IP-24', map),
      ).toBe('ФІОТ');
    });
  });
});

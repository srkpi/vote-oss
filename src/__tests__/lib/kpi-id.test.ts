import * as allure from 'allure-js-commons';

import {
  GraduateUserError,
  InvalidTicketError,
  InvalidUserDataError,
  NotDiiaAuthError,
  NotStudentError,
  NotStudyingError,
  resolveFacultyShortName,
  resolveTicket,
} from '@/lib/kpi-id';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/campus-api', () => ({
  fetchFacultyGroups: jest.fn(),
}));

import { fetchFacultyGroups } from '@/lib/campus-api';

// Default campus stub — returned by the voteoss endpoint.
// Individual tests that need different data override fetch themselves.
const DEFAULT_CAMPUS_RESPONSE = {
  groupName: 'IP-24',
  faculty: 'TEST Faculty',
  status: 'Studying',
  studyForm: 'Денна',
  studyYear: 1,
  speciality: '121',
};

// Default faculty-groups stub (single unambiguous entry for IP-24).
const DEFAULT_FACULTY_GROUPS: Record<string, string[]> = {
  TEST: ['IP-24'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mocks fetch for two sequential calls: KPI ticket → voteoss campus data. */
function mockFetchSequence(ticketPayload: object, campusPayload: object = DEFAULT_CAMPUS_RESPONSE) {
  (fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ticketPayload })
    .mockResolvedValueOnce({ ok: true, json: async () => campusPayload });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('kpi-id', () => {
  beforeEach(() => {
    allure.feature('KPI ID Auth');
    global.fetch = jest.fn();
    (fetchFacultyGroups as jest.Mock).mockResolvedValue(DEFAULT_FACULTY_GROUPS);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  describe('resolveTicket', () => {
    beforeEach(() => allure.story('API Ticket Resolution'));

    it('returns parsed user info on successful response', async () => {
      mockFetchSequence({
        data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'user-123', NAME: 'Ivan Petrenko' },
      });

      const user = await resolveTicket('valid-ticket');

      expect(fetch).toHaveBeenCalledTimes(2); // ticket + voteoss
      expect(user).toMatchObject({
        userId: 'user-123',
        fullName: 'Ivan Petrenko',
        faculty: 'TEST',
        group: 'IP-24',
      });
    });

    it('calls correct URL with query params', async () => {
      mockFetchSequence({
        data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'id', NAME: 'name' },
      });

      await resolveTicket('ticket-1');

      const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain('/api/ticket');
      expect(calledUrl).toContain('ticketId=ticket-1');
      expect(calledUrl).toContain('appId=test-app-id');
      expect(calledUrl).toContain('appSecret=test-secret');
    });

    it('throws InvalidTicketError if response is not ok', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(resolveTicket('bad-ticket')).rejects.toThrow(InvalidTicketError);
    });

    it('throws InvalidTicketError if response has no data field', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await expect(resolveTicket('ticket')).rejects.toThrow(InvalidTicketError);
    });

    it('throws InvalidUserDataError if required fields are missing', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { AUTH_METHOD: '', STUDENT_ID: '', NAME: '' },
        }),
      });
      await expect(resolveTicket('ticket')).rejects.toThrow(InvalidUserDataError);
    });

    it('throws an error if fetch fails', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('network error'));
      await expect(resolveTicket('ticket')).rejects.toThrow('network error');
    });

    it('throws InvalidTicketError for empty ticketId', async () => {
      await expect(resolveTicket('')).rejects.toThrow(InvalidTicketError);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('allows access if both STUDENT_ID and EMPLOYEE_ID are present', async () => {
      mockFetchSequence({
        data: {
          AUTH_METHOD: 'DIIA',
          STUDENT_ID: 'student-123',
          EMPLOYEE_ID: 'employee-456',
          NAME: 'Ivan Petrenko',
        },
      });

      const user = await resolveTicket('ticket-with-both');
      expect(user).toMatchObject({
        userId: 'student-123',
        fullName: 'Ivan Petrenko',
        faculty: 'TEST',
        group: 'IP-24',
      });
    });

    it('throws NotStudentError if only EMPLOYEE_ID is present', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { AUTH_METHOD: 'DIIA', EMPLOYEE_ID: 'employee-456', NAME: 'Petro Shevchenko' },
        }),
      });
      await expect(resolveTicket('employee-only-ticket')).rejects.toThrow(NotStudentError);
    });

    it('throws NotDiiaAuthError if AUTH_METHOD is missing', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { STUDENT_ID: 'student-123', NAME: 'Petro Shevchenko' },
        }),
      });
      await expect(resolveTicket('employee-only-ticket')).rejects.toThrow(NotDiiaAuthError);
    });

    it('throws NotDiiaAuthError if AUTH_METHOD is not DIIA', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            AUTH_METHOD: 'USER_ACCOUNT',
            STUDENT_ID: 'student-123',
            NAME: 'Petro Shevchenko',
          },
        }),
      });
      await expect(resolveTicket('employee-only-ticket')).rejects.toThrow(NotDiiaAuthError);
    });

    it('throws GraduateUserError when the resolved group is a graduate group', async () => {
      mockFetchSequence(
        { data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'grad-001', NAME: 'Petro Aspirant' } },
        {
          groupName: 'FT-51ф',
          faculty: 'TEST Faculty',
          status: 'Studying',
          studyForm: 'Денна',
          studyYear: 5,
          speciality: '121',
        },
      );
      await expect(resolveTicket('ticket-grad')).rejects.toThrow(GraduateUserError);
    });

    it('throws GraduateUserError for all graduate group suffix patterns', async () => {
      const graduateGroups = ['KV-11ф', 'FT-21ф', 'ІО-31фі'];

      for (const groupName of graduateGroups) {
        (fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'grad-001', NAME: 'Petro Aspirant' },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              groupName,
              faculty: 'TEST Faculty',
              status: 'Studying',
              studyForm: 'Денна',
              studyYear: 5,
              speciality: '121',
            }),
          });

        await expect(resolveTicket('ticket-grad')).rejects.toThrow(GraduateUserError);
      }
    });

    it('does not throw GraduateUserError for bachelor groups', async () => {
      (fetchFacultyGroups as jest.Mock).mockResolvedValue({ KV: ['KV-91'] });
      mockFetchSequence(
        { data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'user-001', NAME: 'Ivan Student' } },
        {
          groupName: 'KV-91',
          faculty: 'KV Faculty',
          status: 'Studying',
          studyForm: 'Денна',
          studyYear: 1,
          speciality: '121',
        },
      );

      const user = await resolveTicket('ticket-bachelor');
      expect(user).not.toBeNull();
      expect(user?.group).toBe('KV-91');
    });

    it('does not throw GraduateUserError for master groups', async () => {
      (fetchFacultyGroups as jest.Mock).mockResolvedValue({ KV: ['KV-51мн'] });
      mockFetchSequence(
        { data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'user-002', NAME: 'Olena Master' } },
        {
          groupName: 'KV-51мн',
          faculty: 'KV Faculty',
          status: 'Studying',
          studyForm: 'Денна',
          studyYear: 1,
          speciality: '121',
        },
      );

      const user = await resolveTicket('ticket-master');
      expect(user).not.toBeNull();
      expect(user?.group).toBe('KV-51мн');
    });

    it('GraduateUserError has the correct name property', async () => {
      mockFetchSequence(
        { data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'grad-001', NAME: 'Petro Aspirant' } },
        {
          groupName: 'FT-51ф',
          faculty: 'TEST Faculty',
          status: 'Studying',
          studyForm: 'Денна',
          studyYear: 5,
          speciality: '121',
        },
      );

      try {
        await resolveTicket('ticket-grad');
        fail('Expected GraduateUserError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GraduateUserError);
        expect((err as GraduateUserError).name).toBe('GraduateUserError');
      }
    });

    // -----------------------------------------------------------------------
    // NotStudyingError
    // -----------------------------------------------------------------------

    it('throws NotStudyingError when student status is Dismissed', async () => {
      mockFetchSequence(
        { data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'user-dismissed', NAME: 'Ex Student' } },
        {
          groupName: 'IP-24',
          faculty: 'TEST Faculty',
          status: 'Dismissed',
          studyForm: 'Денна',
          studyYear: 2,
          speciality: '121',
        },
      );

      await expect(resolveTicket('ticket-dismissed')).rejects.toThrow(NotStudyingError);
    });

    it('NotStudyingError has the correct name property', async () => {
      mockFetchSequence(
        { data: { AUTH_METHOD: 'DIIA', STUDENT_ID: 'user-dismissed', NAME: 'Ex Student' } },
        {
          groupName: 'IP-24',
          faculty: 'TEST Faculty',
          status: 'Dismissed',
          studyForm: 'Денна',
          studyYear: 2,
          speciality: '121',
        },
      );

      try {
        await resolveTicket('ticket-dismissed');
        fail('Expected NotStudyingError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NotStudyingError);
        expect((err as NotStudyingError).name).toBe('NotStudyingError');
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('resolveFacultyShortName', () => {
    it('returns the shortFaculty when group appears in exactly one faculty', () => {
      const map: Record<string, string[]> = {
        ФІОТ: ['IP-24', 'KV-11'],
        ФЕА: ['EA-31'],
      };
      expect(
        resolveFacultyShortName('Факультет інформатики та обчислювальної техніки', 'IP-24', map),
      ).toBe('ФІОТ');
    });

    it('uses Levenshtein to pick the best short key when group exists in multiple faculties', () => {
      const map: Record<string, string[]> = {
        ФІОТ: ['IP-24'],
        ФТІ: ['IP-24'],
      };
      // fullFaculty abbreviates to "ФІОТ" — exact match wins
      expect(
        resolveFacultyShortName('Факультет інформатики та обчислювальної техніки', 'IP-24', map),
      ).toBe('ФІОТ');
    });

    it('applies НН→ННІ normalisation when comparing abbreviations', () => {
      const map: Record<string, string[]> = {
        'ННІ ІПТ': ['IP-24'],
        ФІОТ: ['IP-24'],
      };
      // fullFaculty starts with "Навчально-науковий інститут" → abbr starts with "ННі..."
      // after normalisation "НН " → "ННІ", which is closer to "ННІ ІПТ"
      expect(
        resolveFacultyShortName(
          'Навчально-науковий інститут інформаційних та комунікаційних технологій',
          'IP-24',
          map,
        ),
      ).toBe('ННІ ІПТ');
    });
  });
});

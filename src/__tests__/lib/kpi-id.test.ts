import * as allure from 'allure-js-commons';

import { NotDiiaAuthError, NotStudentError, resolveTicket } from '@/lib/kpi-id';

describe('kpi-id', () => {
  beforeEach(() => {
    allure.feature('KPI ID Auth');
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('resolveTicket', () => {
    beforeEach(() => allure.story('API Ticket Resolution'));

    it('returns parsed user info on successful response', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            AUTH_METHOD: 'DIIA',
            STUDENT_ID: 'user-123',
            NAME: 'Ivan Petrenko',
          },
        }),
      });

      const user = await resolveTicket('valid-ticket');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(user).toEqual({
        userId: 'user-123',
        fullName: 'Ivan Petrenko',
        faculty: 'TEST',
        group: 'IP-24',
      });
    });

    it('calls correct URL with query params', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            AUTH_METHOD: 'DIIA',
            STUDENT_ID: 'id',
            NAME: 'name',
          },
        }),
      });

      await resolveTicket('ticket-1');

      const calledUrl = (fetch as jest.Mock).mock.calls[0][0];

      expect(calledUrl).toContain('/api/ticket');
      expect(calledUrl).toContain('ticketId=ticket-1');
      expect(calledUrl).toContain('appId=test-app-id');
      expect(calledUrl).toContain('appSecret=test-secret');
    });

    it('returns null if response is not ok', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      const user = await resolveTicket('bad-ticket');
      expect(user).toBeNull();
    });

    it('returns null if response has no data field', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const user = await resolveTicket('ticket');
      expect(user).toBeNull();
    });

    it('returns null if required fields are missing', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            AUTH_METHOD: '',
            STUDENT_ID: '',
            NAME: '',
          },
        }),
      });

      const user = await resolveTicket('ticket');
      expect(user).toBeNull();
    });

    it('throws an error if fetch fails', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('network error'));
      await expect(resolveTicket('ticket')).rejects.toThrow('network error');
    });

    it('returns null for empty ticketId', async () => {
      const user = await resolveTicket('');
      expect(user).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('allows access if both STUDENT_ID and EMPLOYEE_ID are present', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            AUTH_METHOD: 'DIIA',
            STUDENT_ID: 'student-123',
            EMPLOYEE_ID: 'employee-456',
            NAME: 'Ivan Petrenko',
          },
        }),
      });

      const user = await resolveTicket('ticket-with-both');

      expect(user).toEqual({
        userId: 'student-123',
        fullName: 'Ivan Petrenko',
        faculty: 'TEST',
        group: 'IP-24',
      });
    });

    it('throws NotStudentError if only EMPLOYEE_ID is present', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            AUTH_METHOD: 'DIIA',
            EMPLOYEE_ID: 'employee-456',
            NAME: 'Petro Shevchenko',
          },
        }),
      });

      await expect(resolveTicket('employee-only-ticket')).rejects.toThrow(NotStudentError);
    });

    it('throws NotDiiaAuthError if only AUTH_METHOD is missing', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            STUDENT_ID: 'student-123',
            NAME: 'Petro Shevchenko',
          },
        }),
      });

      await expect(resolveTicket('employee-only-ticket')).rejects.toThrow(NotDiiaAuthError);
    });

    it('throws NotDiiaAuthError if AUTH_METHOD is not DIIA', async () => {
      (fetch as jest.Mock).mockResolvedValue({
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
  });
});

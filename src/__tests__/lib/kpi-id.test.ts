import * as allure from 'allure-js-commons';
import { resolveTicket } from '@/lib/kpi-id';

describe('kpi-id', () => {
  beforeEach(() => {
    allure.feature('KPI ID Auth');
  });

  describe('resolveTicket (PoC mode)', () => {
    beforeEach(() => allure.story('PoC Ticket Resolution'));

    it('resolves superadmin ticket to correct user info', async () => {
      const user = await resolveTicket('ticket-superadmin-1');
      expect(user).not.toBeNull();
      expect(user!.userId).toBe('superadmin-001');
      expect(user!.faculty).toBe('FICE');
    });

    it('resolves regular user ticket correctly', async () => {
      const user = await resolveTicket('ticket-user-1');
      expect(user).not.toBeNull();
      expect(user!.userId).toBe('user-001');
      expect(user!.fullName).toBe('Ivan Petrenko');
      expect(user!.faculty).toBe('FICE');
      expect(user!.group).toBe('KV-91');
    });

    it('returns null for unknown ticket', async () => {
      const user = await resolveTicket('ticket-does-not-exist');
      expect(user).toBeNull();
    });

    it('returns null for empty string ticket', async () => {
      const user = await resolveTicket('');
      expect(user).toBeNull();
    });

    it('resolves all five hardcoded users without error', async () => {
      const tickets = [
        'ticket-superadmin-1',
        'ticket-admin-2',
        'ticket-user-1',
        'ticket-user-2',
        'ticket-user-3',
      ];
      const results = await Promise.all(tickets.map(resolveTicket));
      expect(results.every((r) => r !== null)).toBe(true);
    });
  });
});

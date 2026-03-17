import type { UserInfo } from '@/types/auth';

export const TICKET_MAP: Record<string, UserInfo> = {
  'ticket-superadmin-1': {
    userId: 'superadmin-001',
    fullName: 'Super Admin User',
    faculty: 'FICE',
    group: 'KV-11',
  },
  'ticket-admin-2': {
    userId: 'admin-002',
    fullName: 'Faculty Admin FICE',
    faculty: 'FICE',
    group: 'KV-12',
  },
  'ticket-user-1': {
    userId: 'user-001',
    fullName: 'Ivan Petrenko',
    faculty: 'FICE',
    group: 'KV-91',
  },
  'ticket-user-2': {
    userId: 'user-002',
    fullName: 'Olena Kovalchuk',
    faculty: 'FEL',
    group: 'EL-21',
  },
  'ticket-user-3': {
    userId: 'user-003',
    fullName: 'Mykola Savchenko',
    faculty: 'FMF',
    group: 'MT-31',
  },
};

export const kpiIdMock = {
  resolveTicket: jest.fn<Promise<UserInfo | null>, [string]>(),
};

export function resetKpiIdMock(): void {
  kpiIdMock.resolveTicket.mockReset().mockImplementation(async (ticketId: string) => {
    return TICKET_MAP[ticketId] ?? null;
  });
}

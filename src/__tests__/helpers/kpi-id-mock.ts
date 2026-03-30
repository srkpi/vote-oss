import type { UserInfo } from '@/types/auth';

export class ResolveUserDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTicketError extends ResolveUserDataError {
  constructor(message = 'Invalid or expired ticketId') {
    super(message);
  }
}

export class InvalidUserDataError extends ResolveUserDataError {
  constructor(message = 'Invalid user data retireved from KPI ID') {
    super(message);
  }
}

export class NotStudentError extends ResolveUserDataError {
  constructor(message = 'Platform is only available for students') {
    super(message);
  }
}

export class NotDiiaAuthError extends ResolveUserDataError {
  constructor(message = 'Authentication must be performed through Diia') {
    super(message);
  }
}

export class GraduateUserError extends ResolveUserDataError {
  constructor(message = 'Platform is not available for graduate students') {
    super(message);
  }
}

export class NotStudyingError extends ResolveUserDataError {
  constructor(message = 'Platform is only available for active students') {
    super(message);
  }
}

export const TICKET_MAP: Record<string, UserInfo> = {
  'ticket-superadmin-1': {
    userId: 'superadmin-001',
    fullName: 'Super Admin User',
    faculty: 'FICE',
    group: 'KV-11',
    speciality: 'Computer Science',
    studyYear: 4,
    studyForm: 'FullTime',
  },
  'ticket-admin-2': {
    userId: 'admin-002',
    fullName: 'Faculty Admin FICE',
    faculty: 'FICE',
    group: 'KV-12',
    speciality: undefined,
    studyYear: 3,
    studyForm: 'FullTime',
  },
  'ticket-user-1': {
    userId: 'user-001',
    fullName: 'Ivan Petrenko',
    faculty: 'FICE',
    group: 'KV-91',
    speciality: 'Computer Science',
    studyYear: 3,
    studyForm: 'FullTime',
  },
  'ticket-user-2': {
    userId: 'user-002',
    fullName: 'Olena Kovalchuk',
    faculty: 'FEL',
    group: 'EL-21',
    speciality: undefined,
    studyYear: 2,
    studyForm: 'FullTime',
  },
  'ticket-user-3': {
    userId: 'user-003',
    fullName: 'Mykola Savchenko',
    faculty: 'FMF',
    group: 'MT-31',
    speciality: undefined,
    studyYear: 1,
    studyForm: 'FullTime',
  },
};

export const kpiIdMock = {
  resolveTicket: jest.fn<Promise<UserInfo>, [string]>(),
  ResolveUserDataError,
  InvalidTicketError,
  InvalidUserDataError,
  NotStudentError,
  NotDiiaAuthError,
  GraduateUserError,
  NotStudyingError,
};

export function resetKpiIdMock(): void {
  kpiIdMock.resolveTicket.mockReset().mockImplementation(async (ticketId: string) => {
    const userInfo = TICKET_MAP[ticketId];
    if (userInfo) {
      return userInfo;
    }

    throw new InvalidTicketError();
  });
}

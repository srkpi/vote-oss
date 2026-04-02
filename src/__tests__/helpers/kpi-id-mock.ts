import type { NextResponse } from 'next/server';

import type { KpiIdUserInfo, UserInfo } from '@/types/auth';

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
  constructor(message = 'Invalid user data retrieved from KPI ID') {
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

export const TICKET_MAP: Record<string, KpiIdUserInfo> = {
  'ticket-user-1': {
    STUDENT_ID: 'user-001',
    NAME: 'Ivan Petrenko',
    AUTH_METHOD: 'DIIA',
    EMPLOYEE_ID: '',
    TAX_ID: '1234',
    TRACE_ID: 'some-trace',
    TIME_STAMP: '0000',
  },
  'ticket-grad-1': {
    STUDENT_ID: 'grad-001',
    NAME: 'Petro Aspirant',
    AUTH_METHOD: 'DIIA',
    EMPLOYEE_ID: '',
    TAX_ID: '4321',
    TRACE_ID: 'some-trace-2',
    TIME_STAMP: '0000',
  },
};

export const MOCK_USER_INFO: UserInfo = {
  userId: 'user-001',
  fullName: 'Ivan Petrenko',
  faculty: 'FICE',
  group: 'KV-91',
  speciality: '121',
  studyYear: 3,
  studyForm: 'FullTime',
};

export const kpiIdMock = {
  resolveTicket: jest.fn<Promise<KpiIdUserInfo>, [string]>(),
  resolveUserData: jest.fn(),
  getCampusUserData: jest.fn<Promise<NextResponse | UserInfo>, [KpiIdUserInfo]>(),
  resolveFacultyShortName: jest.fn(),
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
    if (userInfo) return userInfo;
    throw new InvalidTicketError();
  });

  kpiIdMock.getCampusUserData.mockReset().mockImplementation(async () => {
    return MOCK_USER_INFO;
  });
}

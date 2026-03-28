import { KPI_APP_ID, KPI_AUTH_URL } from '@/lib/config/client';
import { KPI_APP_SECRET } from '@/lib/config/server';
import { parseGroupLevel } from '@/lib/group-utils';
import type { UserInfo } from '@/types/auth';

export class ResolveTicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTicketError extends ResolveTicketError {
  constructor(message = 'Invalid or expired ticketId') {
    super(message);
  }
}

export class NotStudentError extends ResolveTicketError {
  constructor(message = 'Platform is only available for students') {
    super(message);
  }
}

export class NotDiiaAuthError extends ResolveTicketError {
  constructor(message = 'Authentication must be performed through Diia') {
    super(message);
  }
}

export class GraduateUserError extends ResolveTicketError {
  constructor(message = 'Platform is not available for graduate students') {
    super(message);
  }
}

export async function resolveTicket(ticketId: string): Promise<UserInfo> {
  if (!ticketId) throw new InvalidTicketError();

  const url = new URL(`${KPI_AUTH_URL}/api/ticket`);
  url.searchParams.set('ticketId', ticketId);
  url.searchParams.set('appId', KPI_APP_ID);
  url.searchParams.set('appSecret', KPI_APP_SECRET);

  const res = await fetch(url.toString());
  if (!res.ok) throw new InvalidTicketError();

  const body = (await res.json()) as { data?: Record<string, string | undefined> };
  if (!body?.data) throw new InvalidTicketError();

  const { data } = body;

  if (!('AUTH_METHOD' in data)) throw new NotDiiaAuthError();

  if (data.AUTH_METHOD && data.AUTH_METHOD !== 'DIIA') throw new NotDiiaAuthError();

  if (!data.STUDENT_ID && data.EMPLOYEE_ID) throw new NotStudentError();

  if (!data.STUDENT_ID || !data.NAME) throw new InvalidTicketError();

  const group = data.GROUP ?? 'IP-24';
  const faculty = data.FACULTY ?? 'TEST';

  if (parseGroupLevel(group) === 'g') {
    throw new GraduateUserError();
  }

  return {
    userId: data.STUDENT_ID,
    fullName: data.NAME,
    faculty,
    group,
    speciality: data.SPECIALITY,
    studyYear: data.STUDY_YEAR ? Number(data.STUDY_YEAR) : undefined,
    studyForm: data.STUDY_FORM,
  };
}

import { KPI_APP_ID, KPI_AUTH_URL } from '@/lib/config/client';
import { KPI_APP_SECRET } from '@/lib/config/server';
import type { TicketUserInfo, UserInfo } from '@/types/auth';

export class NotStudentError extends Error {
  constructor() {
    super('Platform is only available for students');
    this.name = 'NotStudentError';
  }
}

export async function resolveTicket(ticketId: string): Promise<UserInfo | null> {
  if (!ticketId) {
    return null;
  }

  const url = new URL(`${KPI_AUTH_URL}/api/ticket`);
  url.searchParams.append('ticketId', ticketId);
  url.searchParams.append('appId', KPI_APP_ID);
  url.searchParams.append('appSecret', KPI_APP_SECRET);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const ticket: TicketUserInfo = await response.json();

  if (!ticket?.data) {
    return null;
  }

  if (ticket.data.EMPLOYEE_ID && !ticket.data.STUDENT_ID) {
    throw new NotStudentError();
  }

  const userId = ticket.data.STUDENT_ID;
  const fullName = ticket.data.NAME;

  if (!userId || !fullName) {
    return null;
  }

  return {
    userId,
    fullName,
    group: 'IP-24',
    faculty: 'TEST',
  };
}

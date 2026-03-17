import type { TicketUserInfo, UserInfo } from '@/types/auth';

const authUrl = process.env.NEXT_PUBLIC_KPI_AUTH_URL;
const appId = process.env.NEXT_PUBLIC_KPI_APP_ID;
const appSecret = process.env.KPI_APP_SECRET;

export async function resolveTicket(ticketId: string): Promise<UserInfo | null> {
  if (!ticketId) {
    return null;
  }
  if (!authUrl) {
    console.error('[auth/kpi-id] NEXT_PUBLIC_KPI_AUTH_URL not set');
    return null;
  }
  if (!appId) {
    console.error('[auth/kpi-id] NEXT_PUBLIC_KPI_APP_ID not set');
    return null;
  }
  if (!appSecret) {
    console.error('[auth/kpi-id] KPI_APP_SECRET not set');
    return null;
  }

  const url = new URL(`${authUrl}/api/ticket`);
  url.searchParams.append('ticketId', ticketId);
  url.searchParams.append('appId', appId);
  url.searchParams.append('appSecret', appSecret);

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

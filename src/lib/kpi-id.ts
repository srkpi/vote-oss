import type { TicketUserInfo, UserInfo } from '@/types/auth';

export async function resolveTicket(ticketId: string): Promise<UserInfo | null> {
  if (!ticketId) {
    return null;
  }

  const authUrl = process.env.NEXT_PUBLIC_KPI_AUTH_URL;
  if (!authUrl) {
    console.error('NEXT_PUBLIC_KPI_AUTH_URL not set');
    return null;
  }

  const appId = process.env.NEXT_PUBLIC_KPI_APP_ID;
  if (!appId) {
    console.error('NEXT_PUBLIC_KPI_APP_ID not set');
    return null;
  }

  const appSecret = process.env.KPI_APP_SECRET;
  if (!appSecret) {
    console.error('KPI_APP_SECRET not set');
    return null;
  }

  try {
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
  } catch (error) {
    console.error('resolveTicket error:', error);
    return null;
  }
}

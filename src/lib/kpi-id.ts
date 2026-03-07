export type KpiIdUserInfo = {
  userId: string;
  faculty: string;
  group: string;
  fullName: string;
  isAdmin: boolean;
};

const POC_USERS: Record<string, KpiIdUserInfo> = {
  'ticket-superadmin-1': {
    userId: 'superadmin-001',
    faculty: 'FICS',
    group: 'KV-11',
    fullName: 'Super Admin User',
    isAdmin: true,
  },
  'ticket-admin-2': {
    userId: 'admin-002',
    faculty: 'FICS',
    group: 'KV-12',
    fullName: 'Faculty Admin FICS',
    isAdmin: true,
  },
  'ticket-user-1': {
    userId: 'user-001',
    faculty: 'FICS',
    group: 'KV-91',
    fullName: 'Ivan Petrenko',
    isAdmin: false,
  },
  'ticket-user-2': {
    userId: 'user-002',
    faculty: 'FEL',
    group: 'EL-21',
    fullName: 'Olena Kovalchuk',
    isAdmin: false,
  },
  'ticket-user-3': {
    userId: 'user-003',
    faculty: 'FMF',
    group: 'MM-31',
    fullName: 'Dmytro Savchenko',
    isAdmin: false,
  },
};

export async function resolveTicket(ticketId: string): Promise<KpiIdUserInfo | null> {
  if (process.env.NODE_ENV === 'production') {
    return resolveTicketProduction(ticketId);
  }
  return resolveTicketPoC(ticketId);
}

function resolveTicketPoC(ticketId: string): KpiIdUserInfo | null {
  return POC_USERS[ticketId] ?? null;
}

async function resolveTicketProduction(ticketId: string): Promise<KpiIdUserInfo | null> {
  const appId = process.env.KPI_ID_APP_ID;
  const appSecret = process.env.KPI_ID_APP_SECRET;
  const endpoint = process.env.KPI_ID_ENDPOINT;

  if (!appId || !appSecret || !endpoint) {
    throw new Error('KPI ID environment variables are not configured');
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, appSecret, ticketId }),
  });

  if (!res.ok) return null;

  const data = await res.json();

  // TODO: Map the actual KPI ID API response to KpiIdUserInfo
  return {
    userId: data.userId,
    faculty: data.faculty,
    group: data.group,
    fullName: data.fullName,
    isAdmin: data.isAdmin ?? false,
  };
}

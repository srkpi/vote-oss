import { NextRequest, NextResponse } from 'next/server';

import { CRON_SECRET } from '@/lib/config/server';
import { REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expiryDate = new Date(Date.now() - REFRESH_TOKEN_TTL_SECS * 1000);

    const { count } = await prisma.jwtToken.deleteMany({
      where: {
        created_at: {
          lt: expiryDate,
        },
      },
    });

    console.log(
      `[cron/cleanup-tokens] Deleted ${count} expired token(s) older than ${expiryDate.toISOString()}`,
    );

    return NextResponse.json({ deleted: count });
  } catch (err) {
    console.error('[cron/cleanup-tokens] Failed to delete expired tokens:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

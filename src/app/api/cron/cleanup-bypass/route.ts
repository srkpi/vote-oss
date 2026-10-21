import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CRON_SECRET } from '@/lib/config/server';
import { SESSION_INITIAL_AUTH_MAX_DAYS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const maxSessionDuration = new Date(now);
    maxSessionDuration.setDate(now.getDate() + SESSION_INITIAL_AUTH_MAX_DAYS);

    const [{ count: deleted }] = await Promise.all([
      prisma.globalBypassToken.deleteMany({
        where: { valid_until: { lt: maxSessionDuration } },
      }),
    ]);

    console.log(
      `[cron/cleanup-bypass] Deleted ${deleted} global bypass token(s) as of ${now.toISOString()}`,
    );

    return NextResponse.json({ deleted });
  } catch (err) {
    console.error('[cron/cleanup-bypass] Failed to delete expired bypass tokens:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

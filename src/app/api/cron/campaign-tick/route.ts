import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { transitionCampaignsByDate } from '@/lib/campaigns';
import { CRON_SECRET } from '@/lib/config/server';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updated = await transitionCampaignsByDate();
    console.log(`[cron/campaign-tick] Transitioned ${updated} campaign(s)`);
    return NextResponse.json({ updated });
  } catch (err) {
    console.error('[cron/campaign-tick] Failed to tick campaigns:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

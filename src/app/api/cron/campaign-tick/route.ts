import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { transitionCampaignsByDate } from '@/lib/campaigns';
import { CRON_SECRET } from '@/lib/config/server';

/**
 * @swagger
 * /api/cron/campaign-tick:
 *   post:
 *     summary: Advance election campaigns through their state machine
 *     description: >
 *       Walks every active (non-cancelled, non-completed) campaign and
 *       transitions its `state` field to whatever the current clock implies
 *       based on the campaign's configured phase timestamps. Child entity
 *       creation (registration forms, signature elections, final election)
 *       happens in subsequent stages. Must be called with a
 *       `Bearer <CRON_SECRET>` Authorization header. Intended for scheduled
 *       invocation only (e.g. Vercel Cron).
 *     tags:
 *       - Cron
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Tick completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - updated
 *               properties:
 *                 updated:
 *                   type: integer
 *                   description: Number of campaigns whose state was updated in this tick
 *       401:
 *         description: Missing or invalid cron secret
 *       500:
 *         description: Unexpected error during state machine processing
 */
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

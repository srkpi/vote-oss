import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CRON_SECRET } from '@/lib/config/server';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/cron/cleanup-bypass:
 *   post:
 *     summary: Purge expired JWT token records
 *     description: >
 *       Purge expired bypass tokens and their orphaned usages.
 *       Must be called with a `Bearer <CRON_SECRET>` Authorization header
 *       Intended for scheduled invocation only (e.g. Vercel Cron).
 *     tags:
 *       - Cron
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: integer
 *                   description: Number of expired bypass tokens deleted
 *       401:
 *         description: Missing or invalid cron secret
 *       500:
 *         description: Database error during cleanup
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const { count } = await prisma.bypassToken.deleteMany({
      where: { valid_until: { lt: now } },
    });

    console.log(
      `[cron/cleanup-bypass] Deleted ${count} expired bypass token(s) as of ${now.toISOString()}`,
    );

    return NextResponse.json({ deleted: count });
  } catch (err) {
    console.error('[cron/cleanup-bypass] Failed to delete expired bypass tokens:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

import { CRON_SECRET } from '@/lib/config/server';
import { REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/cron/cleanup-tokens:
 *   post:
 *     summary: Purge expired JWT token records
 *     description: >
 *       Cron job endpoint that deletes JWT token rows older than the refresh
 *       token TTL. Must be called with a `Bearer <CRON_SECRET>` Authorization
 *       header. Intended for scheduled invocation only (e.g. Vercel Cron).
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
 *                   description: Number of expired token rows removed
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

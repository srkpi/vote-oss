import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     description: >
 *       Verifies connectivity to the PostgreSQL database and Redis cache.
 *       Returns 200 when both are reachable, 503 otherwise. Suitable for use
 *       as a liveness/readiness probe.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: All systems operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *       503:
 *         description: One or more dependencies are unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unavailable
 *                 db:
 *                   type: boolean
 *                   example: false
 *                 redis:
 *                   type: boolean
 *                   example: false
 */
export async function GET() {
  const dbCheck = prisma.$queryRaw`SELECT 1`.then(
    () => true,
    (err) => {
      console.error('[health] DB health check failed:', err);
      return false;
    },
  );

  const redisCheck = (async () => {
    try {
      const pong = await redis.ping();
      return pong === 'PONG';
    } catch (err) {
      console.error('[health] Redis health check failed:', err);
      return false;
    }
  })();

  const [dbOk, redisOk] = await Promise.all([dbCheck, redisCheck]);

  if (dbOk && redisOk) {
    return NextResponse.json({ status: 'ok' });
  }

  return NextResponse.json({ status: 'unavailable', db: dbOk, redis: redisOk }, { status: 503 });
}

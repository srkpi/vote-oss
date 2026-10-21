import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

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

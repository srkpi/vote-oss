import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const revalidate = 5;
export const dynamic = 'force-dynamic';

export async function GET() {
  const [elections, ballots, petitions] = await Promise.all([
    prisma.election.count({ where: { type: 'ELECTION', deleted_at: null } }),
    prisma.ballot.count({ where: { election: { type: 'ELECTION', deleted_at: null } } }),
    prisma.election.count({ where: { type: 'PETITION', deleted_at: null } }),
  ]);

  return NextResponse.json({ elections, ballots, petitions });
}

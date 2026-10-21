import { type NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export const revalidate = 5;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const now = new Date();
  const [elections, openElections, ballots, petitions, groups, admins] = await Promise.all([
    prisma.election.count({ where: { type: 'ELECTION', deleted_at: null } }),
    prisma.election.count({
      where: {
        type: 'ELECTION',
        deleted_at: null,
        opens_at: { lte: now },
        closes_at: { gt: now },
      },
    }),
    prisma.ballot.count({ where: { election: { type: 'ELECTION', deleted_at: null } } }),
    prisma.election.count({ where: { type: 'PETITION', deleted_at: null } }),
    prisma.group.count({ where: { deleted_at: null } }),
    prisma.admin.count({ where: { deleted_at: null } }),
  ]);

  return NextResponse.json({ elections, openElections, ballots, petitions, groups, admins });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCachedElections } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = await params;

  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election or petition id');
  }

  const cached = await getCachedElections();
  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (!found || found.deletedAt) {
      return Errors.notFound('Election or petition not found');
    }

    return NextResponse.json({
      title: found.title,
      type: found.type,
    });
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId, deleted_at: null },
    select: { title: true, type: true },
  });

  if (!election) {
    return Errors.notFound('Election or petition not found');
  }

  return NextResponse.json({
    title: election.title,
    type: election.type,
  });
}

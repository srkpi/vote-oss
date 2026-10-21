import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { Errors } from '@/lib/errors';
import { GroupNotFoundError } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  const group = await prisma.group.findUnique({
    where: { id, deleted_at: null },
    select: {
      name: true,
    },
  });

  if (!group) return Errors.notFound(new GroupNotFoundError().message);

  return NextResponse.json({ name: group.name });
}

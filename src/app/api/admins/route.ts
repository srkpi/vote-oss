import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Errors.forbidden(auth.error);

  const admins = await prisma.admin.findMany({
    select: {
      user_id: true,
      full_name: true,
      group: true,
      faculty: true,
      promoted_by: true,
      promoted_at: true,
      manage_admins: true,
      restricted_to_faculty: true,
    },
    orderBy: { promoted_at: 'asc' },
  });

  return NextResponse.json(admins);
}

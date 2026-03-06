import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return Errors.badRequest('token is required');
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const inviteToken = await prisma.adminInviteToken.findUnique({
    where: { token_hash: tokenHash },
    include: { creator: true },
  });

  if (!inviteToken) return Errors.notFound('Invalid invite token');
  if (inviteToken.valid_due < now) return Errors.badRequest('Invite token has expired');
  if (inviteToken.current_usage >= inviteToken.max_usage) {
    return Errors.badRequest('Invite token has reached its maximum usage');
  }

  // Check if user is already an admin
  const existingAdmin = await prisma.admin.findUnique({ where: { user_id: user.sub } });
  if (existingAdmin) return Errors.conflict('You are already an admin');

  // Create admin and increment usage atomically
  await prisma.$transaction([
    prisma.admin.create({
      data: {
        user_id: user.sub,
        full_name: user.full_name,
        group: user.group,
        faculty: user.faculty,
        promoted_by: inviteToken.created_by,
        promoted_at: now,
        manage_admins: inviteToken.manage_admins,
        restricted_to_faculty: inviteToken.restricted_to_faculty,
      },
    }),
    prisma.adminInviteToken.update({
      where: { token_hash: tokenHash },
      data: { current_usage: { increment: 1 } },
    }),
  ]);

  return NextResponse.json(
    {
      userId: user.sub,
      fullName: user.full_name,
      faculty: user.faculty,
      group: user.group,
      manageAdmins: inviteToken.manage_admins,
      restrictedToFaculty: inviteToken.restricted_to_faculty,
      promotedBy: inviteToken.created_by,
    },
    { status: 201 },
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateInviteToken, hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Errors.forbidden(auth.error);

  const { admin, user } = auth;

  if (!admin?.manage_admins) {
    return Errors.forbidden('You do not have permission to create admin invites');
  }

  let body: {
    maxUsage?: number;
    manageAdmins?: boolean;
    restrictedToFaculty?: boolean;
    validDue?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { maxUsage = 1, manageAdmins = false, validDue } = body;
  let { restrictedToFaculty = true } = body;

  if (!validDue) return Errors.badRequest('validDue is required');

  const validDueDate = new Date(validDue);
  if (isNaN(validDueDate.getTime()) || validDueDate <= new Date()) {
    return Errors.badRequest('validDue must be a future date');
  }
  if (maxUsage < 1 || maxUsage > 100) {
    return Errors.badRequest('maxUsage must be between 1 and 100');
  }

  // Admins cannot grant more than they have
  if (manageAdmins && !admin.manage_admins) {
    return Errors.forbidden('Cannot grant manage_admins permission you do not have');
  }

  // If creating admin is faculty-restricted, the new admin must also be restricted
  if (admin.restricted_to_faculty) {
    restrictedToFaculty = true;
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashToken(rawToken);

  await prisma.adminInviteToken.create({
    data: {
      token_hash: tokenHash,
      max_usage: maxUsage,
      current_usage: 0,
      manage_admins: manageAdmins,
      restricted_to_faculty: restrictedToFaculty,
      valid_due: validDueDate,
      created_at: new Date(),
      created_by: user.sub,
    },
  });

  return NextResponse.json(
    {
      token: rawToken,
      maxUsage,
      manageAdmins,
      restrictedToFaculty,
      validDue: validDueDate,
    },
    { status: 201 },
  );
}

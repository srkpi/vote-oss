import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { faqReorderBodySchema } from '@/lib/schemas/faq';

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin } = auth;

  if (!admin.manage_faq) {
    return Errors.forbidden('Only admins with FAQ management rights can manage FAQ');
  }

  const parsedBody = await parseRequestBody(req, faqReorderBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const { order } = body;

  // Verify all provided IDs are real categories
  const existing = await prisma.faqCategory.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((c) => c.id));
  if (order.some((id) => !existingIds.has(id))) {
    return Errors.badRequest('order contains unknown category IDs');
  }

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.faqCategory.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );

  await invalidateFaq();

  return new NextResponse(null, { status: 204 });
}

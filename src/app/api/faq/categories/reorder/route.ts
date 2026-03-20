import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// PATCH /api/faq/categories/reorder  — root admin only
// Body: { order: string[] }  — array of category IDs in desired order
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin } = auth;

  if (admin.restricted_to_faculty) {
    return Errors.forbidden('Only non restricted admins can manage FAQ');
  }

  let body: { order?: string[] };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { order } = body;
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    return Errors.badRequest('order must be an array of category IDs');
  }

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

  return NextResponse.json({ ok: true });
}

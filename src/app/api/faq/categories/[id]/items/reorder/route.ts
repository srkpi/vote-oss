import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// PATCH /api/faq/categories/[id]/items/reorder  — root admin only
// Body: { order: string[] }  — array of item IDs in desired order
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin } = auth;

  if (admin.restricted_to_faculty) {
    return Errors.forbidden('Only non restricted admins can manage FAQ');
  }

  const { id: categoryId } = await params;
  if (!categoryId) return Errors.badRequest('categoryId is required');

  const category = await prisma.faqCategory.findUnique({ where: { id: categoryId } });
  if (!category) return Errors.notFound('FAQ category not found');

  let body: { order?: string[] };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { order } = body;
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    return Errors.badRequest('order must be an array of item IDs');
  }

  // Verify all provided IDs belong to this category
  const existing = await prisma.faqItem.findMany({
    where: { category_id: categoryId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((i) => i.id));
  if (order.some((id) => !existingIds.has(id))) {
    return Errors.badRequest('order contains IDs that do not belong to this category');
  }

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.faqItem.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );

  await invalidateFaq();

  return NextResponse.json({ ok: true });
}

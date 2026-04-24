import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/faq/categories/{id}/items/reorder:
 *   patch:
 *     summary: Reorder FAQ items within a category
 *     description: >
 *       Accepts a complete ordered array of item IDs belonging to the
 *       category and updates their `position` values atomically.
 *       Requires the `manage_faq` permission.
 *     tags:
 *       - FAQ
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: FAQ category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Complete ordered list of item IDs for this category
 *     responses:
 *       204:
 *         description: Items reordered
 *       400:
 *         description: Invalid order array or IDs not belonging to this category
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Category not found
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin } = auth;

  if (!admin.manage_faq) {
    return Errors.forbidden('Only admins with FAQ management rights can manage FAQ');
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

  return new NextResponse(null, { status: 204 });
}

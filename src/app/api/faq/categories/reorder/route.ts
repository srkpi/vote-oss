import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/faq/categories/reorder:
 *   patch:
 *     summary: Reorder FAQ categories
 *     description: >
 *       Accepts a complete ordered array of category IDs and updates their
 *       `position` values atomically. Root admins only.
 *     tags:
 *       - FAQ
 *     security:
 *       - cookieAuth: []
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
 *                 description: Complete ordered list of all category IDs
 *     responses:
 *       204:
 *         description: Categories reordered
 *       400:
 *         description: Invalid order array or unknown category IDs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
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

  await invalidateFaq();

  return new NextResponse(null, { status: 204 });
}

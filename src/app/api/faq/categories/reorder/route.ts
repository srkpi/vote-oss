import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { faqReorderBodySchema } from '@/lib/schemas/faq';

/**
 * @swagger
 * /api/faq/categories/reorder:
 *   patch:
 *     summary: Reorder FAQ categories
 *     description: >
 *       Accepts a complete ordered array of category IDs and updates their
 *       `position` values atomically. Requires the `manage_faq` permission.
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

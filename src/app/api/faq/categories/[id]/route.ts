import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { faqCategoryBodySchema } from '@/lib/schemas/faq';

/**
 * @swagger
 * /api/faq/categories/{id}:
 *   put:
 *     summary: Update a FAQ category title
 *     description: Renames the specified FAQ category. Requires the `manage_faq` permission.
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
 *             $ref: '#/components/schemas/FaqCategoryCreateBody'
 *     responses:
 *       200:
 *         description: Category updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FaqCategoryMeta'
 *       400:
 *         description: Missing or invalid title
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Category not found
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_faq) {
    return Errors.forbidden('Only admins with FAQ management rights can manage FAQ');
  }

  const { id } = await params;
  if (!id) {
    return Errors.badRequest('id is required');
  }

  const parsedBody = await parseRequestBody(req, faqCategoryBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const { title } = body;

  const existing = await prisma.faqCategory.findUnique({ where: { id } });
  if (!existing) {
    return Errors.notFound('FAQ category not found');
  }

  const updated = await prisma.faqCategory.update({
    where: { id },
    data: {
      title: title.trim(),
      updated_by: user.sub,
    },
    select: {
      id: true,
      title: true,
      position: true,
      updated_at: true,
    },
  });

  await invalidateFaq();

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    position: updated.position,
    updatedAt: updated.updated_at.toISOString(),
  });
}

/**
 * @swagger
 * /api/faq/categories/{id}:
 *   delete:
 *     summary: Delete a FAQ category
 *     description: Permanently deletes the category and all its items. Requires the `manage_faq` permission.
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
 *     responses:
 *       204:
 *         description: Category deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Category not found
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin } = auth;

  if (!admin.manage_faq) {
    return Errors.forbidden('Only admins with FAQ management rights can manage FAQ');
  }

  const { id } = await params;
  if (!id) {
    return Errors.badRequest('id is required');
  }

  const existing = await prisma.faqCategory.findUnique({ where: { id } });
  if (!existing) {
    return Errors.notFound('FAQ category not found');
  }

  await prisma.faqCategory.delete({ where: { id } });

  await invalidateFaq();

  return new NextResponse(null, { status: 204 });
}

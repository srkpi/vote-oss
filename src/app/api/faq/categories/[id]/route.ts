import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/faq/categories/{id}:
 *   put:
 *     summary: Update a FAQ category title
 *     description: Renames the specified FAQ category. Root admins only.
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
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 100
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

  if (admin.restricted_to_faculty) {
    return Errors.forbidden('Only non restricted admins can manage FAQ');
  }

  const { id } = await params;
  if (!id) return Errors.badRequest('id is required');

  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { title } = body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return Errors.badRequest('title is required');
  }
  if (title.trim().length > FAQ_CATEGORY_TITLE_MAX_LENGTH) {
    return Errors.badRequest(`title must be at most ${FAQ_CATEGORY_TITLE_MAX_LENGTH} characters`);
  }

  const existing = await prisma.faqCategory.findUnique({ where: { id } });
  if (!existing) return Errors.notFound('FAQ category not found');

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
 *     description: Permanently deletes the category and all its items. Root admins only.
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
 *       200:
 *         description: Category deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 deletedId:
 *                   type: string
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

  if (admin.restricted_to_faculty) {
    return Errors.forbidden('Only non restricted admins can manage FAQ');
  }

  const { id } = await params;
  if (!id) return Errors.badRequest('id is required');

  const existing = await prisma.faqCategory.findUnique({ where: { id } });
  if (!existing) return Errors.notFound('FAQ category not found');

  await prisma.faqCategory.delete({ where: { id } });

  await invalidateFaq();

  return NextResponse.json({ ok: true, deletedId: id });
}

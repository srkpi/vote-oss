import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { faqItemBodySchema } from '@/lib/schemas/faq';

/**
 * @swagger
 * /api/faq/items/{id}:
 *   put:
 *     summary: Update a FAQ item
 *     description: >
 *       Replaces the title and content of an existing FAQ item. Content must
 *       be a valid serialised Quill Delta JSON string. Requires the `manage_faq` permission.
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
 *         description: FAQ item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FaqItemCreateBody'
 *     responses:
 *       200:
 *         description: Item updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FaqItem'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Item not found
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

  const existing = await prisma.faqItem.findUnique({ where: { id } });
  if (!existing) {
    return Errors.notFound('FAQ item not found');
  }

  const parsedBody = await parseRequestBody(req, faqItemBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const { title, content } = body;

  const updated = await prisma.faqItem.update({
    where: { id },
    data: {
      title: title.trim(),
      content,
      updated_by: user.sub,
    },
    select: {
      id: true,
      category_id: true,
      title: true,
      content: true,
      position: true,
      updated_at: true,
    },
  });

  await invalidateFaq();

  return NextResponse.json({
    id: updated.id,
    categoryId: updated.category_id,
    title: updated.title,
    content: updated.content,
    position: updated.position,
    updatedAt: updated.updated_at.toISOString(),
  });
}

/**
 * @swagger
 * /api/faq/items/{id}:
 *   delete:
 *     summary: Delete a FAQ item
 *     description: Permanently deletes the specified FAQ item. Requires the `manage_faq` permission.
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
 *         description: FAQ item ID
 *     responses:
 *       204:
 *         description: Item deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Item not found
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

  const existing = await prisma.faqItem.findUnique({ where: { id } });
  if (!existing) {
    return Errors.notFound('FAQ item not found');
  }

  await prisma.faqItem.delete({ where: { id } });

  await invalidateFaq();

  return new NextResponse(null, { status: 204 });
}

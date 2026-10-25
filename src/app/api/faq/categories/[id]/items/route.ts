import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAdmin } from '@/lib/auth';
import { invalidateFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { faqItemBodySchema } from '@/lib/schemas/faq';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_faq) {
    return Errors.forbidden('Only admins with FAQ management rights can manage FAQ');
  }

  const { id: categoryId } = await params;
  if (!categoryId) {
    return Errors.badRequest('categoryId is required');
  }

  const category = await prisma.faqCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    return Errors.notFound('FAQ category not found');
  }

  const parsedBody = await parseRequestBody(req, faqItemBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const { title, content } = body;

  const last = await prisma.faqItem.findFirst({
    where: { category_id: categoryId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  const item = await prisma.faqItem.create({
    data: {
      category_id: categoryId,
      title: title.trim(),
      content,
      position,
      created_by: user.sub,
    },
    select: {
      id: true,
      category_id: true,
      title: true,
      content: true,
      position: true,
      created_at: true,
      updated_at: true,
    },
  });

  await invalidateFaq();

  return NextResponse.json(
    {
      id: item.id,
      categoryId: item.category_id,
      title: item.title,
      content: item.content,
      position: item.position,
      createdAt: item.created_at.toISOString(),
      updatedAt: item.updated_at.toISOString(),
    },
    { status: 201 },
  );
}

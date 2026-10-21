import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAdmin } from '@/lib/auth';
import { getCachedFaq, invalidateFaq, setCachedFaq } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { faqCategoryBodySchema } from '@/lib/schemas/faq';

export async function GET() {
  const cached = await getCachedFaq();
  if (cached) {
    return NextResponse.json(cached);
  }

  const categories = await prisma.faqCategory.findMany({
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      position: true,
      items: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          content: true,
          position: true,
        },
      },
    },
  });

  await setCachedFaq(categories);

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_faq) {
    return Errors.forbidden('Only admins with FAQ management rights can manage FAQ');
  }

  const parsedBody = await parseRequestBody(req, faqCategoryBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const { title } = body;

  const last = await prisma.faqCategory.findFirst({
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  const category = await prisma.faqCategory.create({
    data: {
      title: title.trim(),
      position,
      created_by: user.sub,
    },
    select: {
      id: true,
      title: true,
      position: true,
      created_at: true,
      updated_at: true,
    },
  });

  await invalidateFaq();

  return NextResponse.json(
    {
      id: category.id,
      title: category.title,
      position: category.position,
      createdAt: category.created_at.toISOString(),
      updatedAt: category.updated_at.toISOString(),
    },
    { status: 201 },
  );
}

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { FAQ_ITEM_CONTENT_MAX_LENGTH, FAQ_ITEM_TITLE_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { deltaToPlainText, parseQuillDelta } from '@/lib/utils';

// ---------------------------------------------------------------------------
// POST /api/faq/categories/[id]/items  — root admin only
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (admin.restricted_to_faculty) {
    return Errors.forbidden('Only non restricted admins can manage FAQ');
  }

  const { id: categoryId } = await params;
  if (!categoryId) return Errors.badRequest('categoryId is required');

  const category = await prisma.faqCategory.findUnique({ where: { id: categoryId } });
  if (!category) return Errors.notFound('FAQ category not found');

  let body: { title?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { title, content } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return Errors.badRequest('title is required');
  }
  if (title.trim().length > FAQ_ITEM_TITLE_MAX_LENGTH) {
    return Errors.badRequest(`title must be at most ${FAQ_ITEM_TITLE_MAX_LENGTH} characters`);
  }

  if (content === undefined || content === null || typeof content !== 'string') {
    return Errors.badRequest('content is required');
  }

  if (!parseQuillDelta(content)) {
    return Errors.badRequest('content must be a valid Quill Delta JSON string');
  }

  const plainText = deltaToPlainText(content);
  if (plainText.length > FAQ_ITEM_CONTENT_MAX_LENGTH) {
    return Errors.badRequest(
      `content plain text must be at most ${FAQ_ITEM_CONTENT_MAX_LENGTH} characters`,
    );
  }

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

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { FAQ_ITEM_CONTENT_MAX_LENGTH, FAQ_ITEM_TITLE_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { deltaToPlainText, parseQuillDelta } from '@/lib/utils';

// ---------------------------------------------------------------------------
// PUT /api/faq/items/[id]  — root admin only
// Updates title and/or content of a FAQ item.
// `content` must be a JSON string of a Quill Delta ({ ops: [...] }).
// The plain-text length of the content is validated, not the raw JSON length.
// ---------------------------------------------------------------------------

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

  const existing = await prisma.faqItem.findUnique({ where: { id } });
  if (!existing) return Errors.notFound('FAQ item not found');

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

  // Content must be a valid Quill Delta JSON string
  if (!parseQuillDelta(content)) {
    return Errors.badRequest('content must be a valid Quill Delta JSON string');
  }

  // Enforce the limit on readable plain text, not the raw JSON envelope
  const plainText = deltaToPlainText(content);
  if (plainText.length > FAQ_ITEM_CONTENT_MAX_LENGTH) {
    return Errors.badRequest(
      `content plain text must be at most ${FAQ_ITEM_CONTENT_MAX_LENGTH} characters`,
    );
  }

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

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// DELETE /api/faq/items/[id]  — root admin only
// ---------------------------------------------------------------------------

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

  const existing = await prisma.faqItem.findUnique({ where: { id } });
  if (!existing) return Errors.notFound('FAQ item not found');

  await prisma.faqItem.delete({ where: { id } });

  return NextResponse.json({ ok: true, deletedId: id });
}

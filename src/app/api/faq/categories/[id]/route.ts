import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// PUT /api/faq/categories/[id]  — root admin only
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

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    position: updated.position,
    updatedAt: updated.updated_at.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/faq/categories/[id]  — root admin only
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

  const existing = await prisma.faqCategory.findUnique({ where: { id } });
  if (!existing) return Errors.notFound('FAQ category not found');

  await prisma.faqCategory.delete({ where: { id } });

  return NextResponse.json({ ok: true, deletedId: id });
}

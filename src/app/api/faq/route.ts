import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// GET /api/faq  — public, no authentication required
// Returns all FAQ categories with their items ordered by position.
// ---------------------------------------------------------------------------

export async function GET() {
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

  return NextResponse.json(categories);
}

// ---------------------------------------------------------------------------
// POST /api/faq  — root admin only
// Creates a new FAQ category appended at the end.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (admin.restricted_to_faculty) {
    return Errors.forbidden('Only non restricted admins can manage FAQ');
  }

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

  return NextResponse.json(category, { status: 201 });
}

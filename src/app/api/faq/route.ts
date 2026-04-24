import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedFaq, invalidateFaq, setCachedFaq } from '@/lib/cache';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/faq:
 *   get:
 *     summary: List all FAQ categories with their items
 *     description: >
 *       Public endpoint – no authentication required. Returns the full FAQ
 *       tree ordered by category position, with each category's items ordered
 *       by item position. Results are served from cache when available.
 *     tags:
 *       - FAQ
 *     responses:
 *       200:
 *         description: Array of FAQ categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FaqCategory'
 */
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

/**
 * @swagger
 * /api/faq:
 *   post:
 *     summary: Create a FAQ category
 *     description: >
 *       Creates a new FAQ category appended at the end of the existing order.
 *       Restricted to admins with the `manage_faq` permission.
 *     tags:
 *       - FAQ
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FaqCategoryCreateBody'
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FaqCategoryMeta'
 *       400:
 *         description: Missing or invalid title
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – admin does not have FAQ management rights
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_faq) {
    return Errors.forbidden('Only admins with FAQ management rights can manage FAQ');
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

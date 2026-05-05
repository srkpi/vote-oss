import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { PROTOCOL_GENERATOR_URL, PROTOCOL_TEMPLATE_ID } from '@/lib/config/server';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { buildGeneratorPayload } from '@/lib/protocols';
import { isValidUuid } from '@/lib/utils/common';

function sanitizeFilename(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * @swagger
 * /api/protocols/{id}/generate:
 *   post:
 *     summary: Generate the protocol PDF via the external KPI docs generator
 *     description: >
 *       Any authenticated user may generate the PDF for a protocol.  No PDF is
 *       stored on this server — the response is the freshly-rendered binary
 *       streamed straight from the generator.
 *     tags: [Protocols]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid protocol id');

  const protocol = await prisma.protocol.findUnique({
    where: { id },
    select: {
      group_id: true,
      deleted_at: true,
      name: true,
      number: true,
      date: true,
      group: { select: { owner_id: true, deleted_at: true } },
    },
  });
  if (!protocol || protocol.deleted_at || protocol.group.deleted_at) {
    return Errors.notFound('Protocol not found');
  }

  const payload = await buildGeneratorPayload(id);

  // Generator requires every responsible / event to be filled and oss to be
  // complete — surface a helpful error before paying for the round-trip.
  if (!payload.oss.name || !payload.oss.address || !payload.oss.email || !payload.oss.contact) {
    return Errors.badRequest(
      'Реквізити групи неповні — заповніть всі поля у блоці "Реквізити" сторінки групи',
    );
  }
  if (payload.responsibles.length === 0) {
    return Errors.badRequest('Має бути хоча б один відповідальний');
  }
  if (payload.events.length === 0) {
    return Errors.badRequest('Протокол має містити хоча б один пункт порядку денного');
  }

  const url = `${PROTOCOL_GENERATOR_URL}/drive/documents/${PROTOCOL_TEMPLATE_ID}/generate`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables: payload }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        message: 'Не вдалось звʼязатися з генератором документів',
        detail: err instanceof Error ? err.message : 'Network error',
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text().catch(() => null);
    }
    return NextResponse.json(
      {
        message: `Генератор повернув помилку (${response.status})`,
        detail,
      },
      { status: response.status === 400 ? 400 : 502 },
    );
  }

  const contentType = response.headers.get('content-type') ?? 'application/pdf';
  const baseName = protocol.number
    ? `Protocol_No${protocol.number}_${protocol.date.toISOString().slice(0, 10)}`
    : `Protocol_${protocol.date.toISOString().slice(0, 10)}`;
  const filename = `${sanitizeFilename(baseName, 'protocol')}.pdf`;

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}

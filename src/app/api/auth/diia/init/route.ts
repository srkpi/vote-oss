import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { KPI_AUTH_URL } from '@/lib/config/client';
import { DIIA_LINK_TTL_MS } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';

interface DiiaAppLinkResponse {
  deepLink: string;
  pageLink: string;
  requestId: string;
  createdAt: string;
}

/**
 * @swagger
 * /api/auth/diia/init:
 *   post:
 *     summary: Initialise a Diia authentication session
 *     description: >
 *       Contacts the KPI-ID provider to create a new Diia deep-link / QR code.
 *       Returns the deep-link, request ID (used for polling), a pre-rendered
 *       QR code data-URL, and an expiry timestamp.  The link is valid for
 *       approximately 2 minutes.  Rate-limited per IP.
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Deep-link and QR code ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deepLink:
 *                   type: string
 *                 requestId:
 *                   type: string
 *                 qrCode:
 *                   type: string
 *                   description: Base-64 PNG data-URL
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       429:
 *         description: Too many requests
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 *       500:
 *         description: Failed to contact KPI-ID provider
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimitLogin(ip);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'TooManyRequests', message: 'Too many requests. Try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1_000)) },
      },
    );
  }

  let linkData: DiiaAppLinkResponse;
  try {
    const url = new URL(`${KPI_AUTH_URL}/api/diia/app-link`);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.error('[diia/init] KPI-ID responded with', res.status);
      return Errors.internal('Failed to get DIIA link from provider');
    }

    linkData = (await res.json()) as DiiaAppLinkResponse;
  } catch (err) {
    console.error('[diia/init] fetch error:', err);
    return Errors.internal('Failed to contact auth provider');
  }

  const { deepLink, requestId } = linkData;
  if (!deepLink || !requestId) {
    console.error('[diia/init] unexpected provider response:', linkData);
    return Errors.internal('Invalid response from auth provider');
  }

  let qrCode: string;
  try {
    qrCode = await QRCode.toDataURL(deepLink, {
      width: 256,
      margin: 2,
      color: { dark: '#000000ff', light: '#ffffffff' },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('[diia/init] QR generation error:', err);
    return Errors.internal('Failed to generate QR code');
  }

  const expiresAt = new Date(Date.now() + DIIA_LINK_TTL_MS).toISOString();

  return NextResponse.json({ deepLink, requestId, qrCode, expiresAt });
}

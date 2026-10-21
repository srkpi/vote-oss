import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { KPI_AUTH_URL } from '@/lib/config/client';
import { DIIA_LINK_TTL_MS } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';
import type { DiiaKpiIdResponse } from '@/types/auth';

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

  let linkData: DiiaKpiIdResponse;
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

    linkData = (await res.json()) as DiiaKpiIdResponse;
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

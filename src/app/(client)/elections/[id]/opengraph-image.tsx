import { ImageResponse } from 'next/og';

import { serverApi } from '@/lib/api/server';
import {
  buildOgFontConfig,
  buildOgImageElement,
  clampTitle,
  ICON_ELECTION,
  loadOgFonts,
  ogContentType,
  ogSize,
} from '@/lib/utils/og-image';

export const runtime = 'nodejs';
export const alt = 'Голосування';
export const size = ogSize;
export const contentType = ogContentType;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ElectionOgImage({ params }: Props) {
  const { id } = await params;
  const { data, success, status } = await serverApi.elections.get(id);
  if (!success) {
    return new Response(null, { status: status || 503 });
  }

  const { onest, bitter } = await loadOgFonts();

  return new ImageResponse(
    buildOgImageElement({
      title: clampTitle(data.title),
      icon: ICON_ELECTION,
      iconBg: 'rgba(255,255,255,0.10)',
      iconBorder: '2px solid rgba(255,255,255,0.22)',
      accentColor: 'rgba(0,138,207,0.3)',
    }),
    { ...size, fonts: buildOgFontConfig(onest, bitter) },
  );
}

import { ImageResponse } from 'next/og';

import { serverApi } from '@/lib/api/server';
import {
  buildOgFontConfig,
  buildOgImageElement,
  clampTitle,
  ICON_PETITION,
  loadOgFonts,
  ogContentType,
  ogSize,
} from '@/lib/utils/og-image';

export const runtime = 'nodejs';
export const alt = 'Петиція';
export const size = ogSize;
export const contentType = ogContentType;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PetitionOgImage({ params }: Props) {
  const { id } = await params;
  const { data, success, status } = await serverApi.elections.get(id);
  if (!success) {
    return new Response(null, { status: status || 503 });
  }

  const { onest, bitter } = await loadOgFonts();

  return new ImageResponse(
    buildOgImageElement({
      title: clampTitle(data.title),
      icon: ICON_PETITION,
      iconBg: 'rgba(240,125,0,0.18)',
      iconBorder: '2px solid rgba(240,125,0,0.55)',
      accentColor: 'rgba(240,125,0,0.35)',
      label: 'ПЕТИЦІЯ',
      labelColor: '#f07d00',
    }),
    { ...size, fonts: buildOgFontConfig(onest, bitter) },
  );
}

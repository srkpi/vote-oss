import { ImageResponse } from 'next/og';

import {
  buildOgFontConfig,
  buildOgImageElement,
  clampTitle,
  ICON_ELECTION,
  loadOgFonts,
  ogContentType,
  ogSize,
} from '@/components/common/og-image';
import { serverApi } from '@/lib/api/server';

export const runtime = 'nodejs';
export const alt = 'Голосування';
export const size = ogSize;
export const contentType = ogContentType;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ElectionOgImage({ params }: Props) {
  const { id } = await params;
  const { onest, bitter } = await loadOgFonts();
  const { data, status } = await serverApi.elections.og(id);

  let metaTitle = 'Голосування';
  if (status === 404) metaTitle = 'Голосування не знайдено';
  else if (data?.title) metaTitle = data.title;

  return new ImageResponse(
    buildOgImageElement({
      title: clampTitle(metaTitle),
      icon: ICON_ELECTION,
      iconBg: 'rgba(255,255,255,0.10)',
      iconBorder: '2px solid rgba(255,255,255,0.22)',
      accentColor: 'rgba(0,138,207,0.3)',
    }),
    { ...size, fonts: buildOgFontConfig(onest, bitter) },
  );
}

import { ImageResponse } from 'next/og';

import { serverApi } from '@/lib/api/server';
import {
  buildOgFontConfig,
  buildOgImageElement,
  clampTitle,
  ICON_GROUPS,
  loadOgFonts,
  ogContentType,
  ogSize,
} from '@/lib/utils/og-image';

export const runtime = 'nodejs';
export const alt = 'Група';
export const size = ogSize;
export const contentType = ogContentType;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GroupOgImage({ params }: Props) {
  const { id } = await params;
  const { data, success, status } = await serverApi.groups.get(id);
  if (!success) {
    return new Response(null, { status: status || 503 });
  }

  const { onest, bitter } = await loadOgFonts();

  return new ImageResponse(
    buildOgImageElement({
      title: clampTitle(data.name),
      icon: ICON_GROUPS,
      iconBg: 'rgba(0,138,207,0.18)',
      iconBorder: '2px solid rgba(0,138,207,0.55)',
      accentColor: 'rgba(0,138,207,0.3)',
      label: 'ГРУПА',
      labelColor: '#008acf',
    }),
    { ...size, fonts: buildOgFontConfig(onest, bitter) },
  );
}

import { ImageResponse } from 'next/og';

import {
  buildOgFontConfig,
  buildOgImageElement,
  clampTitle,
  ICON_GROUPS,
  loadOgFonts,
  ogContentType,
  ogSize,
} from '@/components/common/og-image';
import { serverApi } from '@/lib/api/server';

export const runtime = 'nodejs';
export const alt = 'Група';
export const size = ogSize;
export const contentType = ogContentType;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GroupOgImage({ params }: Props) {
  const { id } = await params;
  const { onest, bitter } = await loadOgFonts();
  const { data, status } = await serverApi.groups.og(id);

  let metaTitle = 'Група';
  if (status === 404) metaTitle = 'Групу не знайдено';
  else if (data?.name) metaTitle = data.name;

  return new ImageResponse(
    buildOgImageElement({
      title: clampTitle(metaTitle),
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

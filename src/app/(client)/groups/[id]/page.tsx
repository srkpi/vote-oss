import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { GroupDetailClient } from '@/components/groups/group-detail-client';
import { serverApi } from '@/lib/api/server';
import { APP_URL } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { data, status } = await serverApi.groups.og(id);

  let metaTitle = 'Група';
  if (status === 404 || status === 400) {
    metaTitle = '404 | Групу не знайдено';
  } else if (data?.name) {
    metaTitle = data.name;
  }

  return {
    title: metaTitle,
    description: 'Керування групою та членством в ній',
    openGraph: {
      title: metaTitle,
      description: 'Керування групою та членством в ній',
      url: new URL(`/groups/${id}`, APP_URL),
      images: [OPENGRAPH_IMAGE_DATA],
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: 'Керування групами та членством в них',
      images: [OPENGRAPH_IMAGE_DATA],
    },
  };
}

export default async function GroupDetailPage({ params }: Props) {
  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const { data: group, status } = await serverApi.groups.get(id);

  if (status === 404 || !group) notFound();

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <GroupDetailClient group={group} session={session} />
    </div>
  );
}

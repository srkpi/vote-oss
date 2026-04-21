import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { GroupsClient } from '@/components/groups/groups-client';
import { serverApi } from '@/lib/api/server';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const metadata: Metadata = {
  title: 'Ваші групи',
  description: 'Керування групами та членством в них',
  openGraph: {
    title: `Ваші групи | ${APP_NAME}`,
    description: 'Керування групами та членством в них',
    url: new URL('/groups', APP_URL),
    images: [OPENGRAPH_IMAGE_DATA],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Ваші групи | ${APP_NAME}`,
    description: 'Керування групами та членством в них',
    images: [OPENGRAPH_IMAGE_DATA],
  },
};

export default async function GroupsPage() {
  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) redirect('/login');

  const { data: groups, error } = await serverApi.groups.list();
  const canCreateGroups = session.isAdmin && session.manageGroups;

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <GroupsClient initialGroups={groups ?? []} canCreateGroups={canCreateGroups} error={error} />
    </div>
  );
}

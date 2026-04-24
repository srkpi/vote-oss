import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { SessionGuard } from '@/components/common/session-guard';
import { PetitionsListClient } from '@/components/petitions/petitions-list-client';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const metadata: Metadata = {
  title: 'Петиції',
  description: 'Список активних петицій',
  openGraph: {
    title: `Петиції | ${APP_NAME}`,
    description: 'Список активних петицій',
    url: new URL('/petitions', APP_URL),
    images: [OPENGRAPH_IMAGE_DATA],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Петиції | ${APP_NAME}`,
    description: 'Список активних петицій',
    images: [OPENGRAPH_IMAGE_DATA],
  },
};

type SortKey = 'createdAt' | 'votes';

interface PetitionsPageProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function PetitionsPage({ searchParams }: PetitionsPageProps) {
  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { sort: sortParam } = await searchParams;
  const sort: SortKey = sortParam === 'votes' ? 'votes' : 'createdAt';

  const { data, error } = await serverApi.elections.list({ type: 'PETITION', sort });
  const petitions = data?.elections ?? [];

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <SessionGuard userId={session.userId} />
      <PageHeader
        title="Петиції"
        description="Підтримайте важливі для університету ініціативи"
        isContainer
      >
        <Button variant="accent" size="sm" asChild>
          <Link href="/petitions/new" className="inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Створити петицію</span>
          </Link>
        </Button>
      </PageHeader>

      <div className="container py-8">
        {error ? (
          <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
            <ErrorState title="Не вдалося завантажити петиції" description={error} />
          </div>
        ) : (
          <PetitionsListClient petitions={petitions} sort={sort} />
        )}
      </div>
    </div>
  );
}

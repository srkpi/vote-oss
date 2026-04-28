import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RegistrationListClient } from '@/components/registration/registration-list-client';
import { serverApi } from '@/lib/api/server';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const metadata: Metadata = {
  title: 'Реєстрація кандидатів',
  description: 'Подача заявок кандидатів у виборні органи',
  openGraph: {
    title: `Реєстрація кандидатів | ${APP_NAME}`,
    description: 'Подача заявок кандидатів у виборні органи',
    url: new URL('/registration', APP_URL),
    images: [OPENGRAPH_IMAGE_DATA],
  },
};

export default async function RegistrationListPage() {
  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) redirect('/login');

  const { data: forms, error } = await serverApi.registrationForms.list();

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <RegistrationListClient initialForms={forms ?? []} error={error} />
    </div>
  );
}

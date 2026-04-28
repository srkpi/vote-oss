import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { RegistrationFormClient } from '@/components/registration/registration-form-client';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';

interface RegistrationFormPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RegistrationFormPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverApi.registrationForms.get(id);
  return {
    title: data?.title ?? 'Реєстрація',
    description: data?.description ?? 'Подача заявки кандидата',
  };
}

export default async function RegistrationFormPage({ params }: RegistrationFormPageProps) {
  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const { data, status } = await serverApi.registrationForms.get(id);
  if (status === 404 || !data) notFound();

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <RegistrationFormClient initial={data} />
    </div>
  );
}

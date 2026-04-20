import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { JoinPageContent } from '@/app/(client)/join/page';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Приєднатися як адміністратор',
  description: 'Використайте токен запрошення, щоб отримати права адміністратора',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinWithTokenPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { token } = await params;

  return <JoinPageContent session={session} initialToken={decodeURIComponent(token)} />;
}

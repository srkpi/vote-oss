import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerSession } from '@/lib/server-auth';
import { JoinPageContent } from '@/app/join/page';

export const metadata: Metadata = {
  title: 'Приєднатися як адміністратор',
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinWithTokenPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  if (session.isAdmin) redirect('/admin');

  const { token } = await params;

  const decodedToken = decodeURIComponent(token);

  return <JoinPageContent session={session} initialToken={decodedToken} />;
}

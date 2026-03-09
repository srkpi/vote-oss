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
  const session = (await getServerSession())!;
  const { token } = await params;

  return <JoinPageContent session={session} initialToken={decodeURIComponent(token)} />;
}

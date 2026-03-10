import type { Metadata } from 'next';

import { JoinPageContent } from '@/app/join/page';
import { getServerSession } from '@/lib/server-auth';

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

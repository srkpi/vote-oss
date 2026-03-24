import { Header } from '@/components/layout/header';
import { getServerSession } from '@/lib/server-auth';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header session={session} />
      <main className="flex-1 pt-(--header-height)">{children}</main>
    </div>
  );
}

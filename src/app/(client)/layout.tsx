import { Header } from '@/components/layout/header';
import { getServerSession } from '@/lib/server-auth';
import { PostHogProvider } from '@/providers/posthog-provider';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return (
    <PostHogProvider session={session}>
      <div className="bg-card flex min-h-dvh flex-col">
        <Header session={session} />
        <main className="bg-background mt-(--header-height) flex-1">{children}</main>
      </div>
    </PostHogProvider>
  );
}

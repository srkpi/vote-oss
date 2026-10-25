import { Header } from '@/components/layout/header';
import { getServerSession } from '@/lib/server-auth';
import { PostHogProvider } from '@/providers/posthog-provider';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return (
    <PostHogProvider session={session}>
      <div className="flex min-h-dvh flex-col bg-card">
        <Header session={session} />
        <main className="mt-(--header-height) flex-1 bg-background">{children}</main>
      </div>
    </PostHogProvider>
  );
}

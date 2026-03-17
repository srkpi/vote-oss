import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

interface VotingSuccessProps {
  hash: string;
  electionId: string;
}

export function VotingSuccess({ hash, electionId }: VotingSuccessProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center text-center gap-6 py-4 animate-scale-in">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-[var(--success-bg)] border-2 border-[var(--success)]/30 flex items-center justify-center">
          <Check className="w-10 h-10 text-[var(--success)]" />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-display text-2xl font-semibold text-[var(--foreground)]">
          Голос зараховано!
        </h4>
        <p className="text-sm text-[var(--muted-foreground)] font-body">
          Ваш голос успішно зафіксовано. Вибір та хеш збережено у вашому браузері.
        </p>
      </div>

      <div className="w-full p-4 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--muted-foreground)] mb-1.5 font-body">
          Хеш бюлетеня (для перевірки):
        </p>
        <p className="font-mono text-xs text-[var(--foreground)] break-all leading-relaxed">
          {hash}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Button variant="primary" fullWidth onClick={() => router.push(`/elections`)}>
          До сторінки опитувань
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => router.push(`/elections/${electionId}/ballots`)}
        >
          Переглянути бюлетені
        </Button>
      </div>
    </div>
  );
}

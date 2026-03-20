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
    <div className="animate-scale-in flex flex-col items-center gap-6 py-4 text-center">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-(--success)/30 bg-(--success-bg)">
          <Check className="h-10 w-10 text-(--success)" />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-display text-2xl font-semibold text-(--foreground)">
          Голос зараховано!
        </h4>
        <p className="font-body text-sm text-(--muted-foreground)">
          Ваш голос успішно зафіксовано. Вибір та хеш збережено у вашому браузері.
        </p>
      </div>

      <div className="w-full rounded-lg border border-(--border-subtle) bg-(--surface) p-4">
        <p className="font-body mb-1.5 text-xs text-(--muted-foreground)">
          Хеш бюлетеня (для перевірки):
        </p>
        <p className="font-mono text-xs leading-relaxed break-all text-(--foreground)">{hash}</p>
      </div>

      <div className="flex w-full flex-col gap-3">
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

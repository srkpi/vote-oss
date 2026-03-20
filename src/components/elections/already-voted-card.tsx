import { Check, CheckCircle, Copy, Hash } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { VoteRecord } from '@/types/vote';

interface AlreadyVotedCardProps {
  record: VoteRecord;
}

export function AlreadyVotedCard({ record }: AlreadyVotedCardProps) {
  const [copied, setCopied] = useState(false);

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(record.ballotHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-(--success)/30 bg-(--success-bg) p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--success)/15">
          <CheckCircle className="h-5 w-5 text-(--success)" />
        </div>
        <div>
          <p className="font-body text-sm font-semibold text-(--success)">Ви вже проголосували</p>
          <p className="font-body mt-0.5 text-xs text-(--muted-foreground)">
            {new Intl.DateTimeFormat('uk-UA', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(record.votedAt))}
          </p>
        </div>
      </div>

      <p className="font-body mb-2 text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
        Ваш вибір
      </p>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg p-4',
          'border-2 border-(--kpi-navy)/20 bg-(--kpi-navy)/5',
        )}
      >
        <span className="navy-gradient font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white">
          ✓
        </span>
        <span className="font-body min-w-0 font-semibold wrap-break-word text-(--kpi-navy)">
          {record.choiceLabel}
        </span>
      </div>

      <p className="font-body text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
        Хеш вашого бюлетеня
      </p>
      <button
        onClick={copyHash}
        title="Натисніть, щоб скопіювати"
        className={cn(
          'group w-full cursor-pointer rounded-(--radius) border p-3 text-left transition-all duration-150',
          copied
            ? 'border-(--success)/40 bg-(--success-bg) shadow-(--shadow-xs)'
            : 'border-(--border-subtle) bg-(--surface) hover:border-(--kpi-blue-light) hover:bg-(--kpi-navy)/3 hover:shadow-(--shadow-xs)',
        )}
      >
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 shrink-0 text-(--kpi-gray-mid)" />
          <p className="flex-1 font-mono text-sm leading-relaxed break-all text-(--foreground)">
            {record.ballotHash}
          </p>
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-150',
              copied
                ? 'bg-(--success)/15 text-(--success)'
                : 'bg-(--kpi-navy)/8 text-(--kpi-gray-mid) group-hover:bg-(--kpi-blue-light)/15 group-hover:text-(--kpi-blue-light)',
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </div>
        </div>
      </button>

      <p className="font-body text-center text-xs leading-relaxed text-(--muted-foreground)">
        Збережено локально у вашому браузері. Використовуйте хеш для верифікації бюлетеня.
      </p>
    </div>
  );
}

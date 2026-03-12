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
    <div className="space-y-5 animate-scale-in">
      {/* Success header */}
      <div className="flex items-center gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--success-bg)] border border-[var(--success)]/30">
        <div className="w-9 h-9 rounded-full bg-[var(--success)]/15 flex items-center justify-center shrink-0">
          <CheckCircle className="w-5 h-5 text-[var(--success)]" />
        </div>
        <div>
          <p className="text-sm font-body font-semibold text-[var(--success)]">
            Ви вже проголосували
          </p>
          <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5">
            {new Intl.DateTimeFormat('uk-UA', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(record.votedAt))}
          </p>
        </div>
      </div>

      {/* Choice display */}
      <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-2">
        Ваш вибір
      </p>
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-[var(--radius-lg)]',
          'bg-[var(--kpi-navy)]/5 border-2 border-[var(--kpi-navy)]/20',
        )}
      >
        <span className="w-8 h-8 rounded-lg navy-gradient text-white flex items-center justify-center font-display font-bold text-base shrink-0">
          ✓
        </span>
        <span className="font-body font-semibold text-[var(--kpi-navy)] min-w-0 break-words">
          {record.choiceLabel}
        </span>
      </div>

      {/* Ballot hash */}
      <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body">
        Хеш вашого бюлетеня
      </p>
      <button
        onClick={copyHash}
        title="Натисніть, щоб скопіювати"
        className={cn(
          'w-full p-3 rounded-[var(--radius)] border text-left transition-all duration-150 group cursor-pointer',
          copied
            ? 'bg-[var(--success-bg)] border-[var(--success)]/40 shadow-[var(--shadow-xs)]'
            : 'bg-[var(--surface)] border-[var(--border-subtle)] hover:border-[var(--kpi-blue-light)] hover:shadow-[var(--shadow-xs)] hover:bg-[var(--kpi-navy)]/3',
        )}
      >
        <div className="flex items-center gap-2">
          <Hash className="w-3.5 h-3.5 text-[var(--kpi-gray-mid)] shrink-0" />
          <p className="font-mono text-sm text-[var(--foreground)] break-all leading-relaxed flex-1">
            {record.ballotHash}
          </p>
          <div
            className={cn(
              'shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150',
              copied
                ? 'bg-[var(--success)]/15 text-[var(--success)]'
                : 'bg-[var(--kpi-navy)]/8 text-[var(--kpi-gray-mid)] group-hover:bg-[var(--kpi-blue-light)]/15 group-hover:text-[var(--kpi-blue-light)]',
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </div>
        </div>
      </button>

      <p className="text-xs text-center text-[var(--muted-foreground)] font-body leading-relaxed">
        Збережено локально у вашому браузері. Використовуйте хеш для верифікації бюлетеня.
      </p>
    </div>
  );
}

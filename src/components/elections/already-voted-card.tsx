import { Check, CheckCircle, Copy, Hash, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';

import { LocalDateTime } from '@/components/ui/local-time';
import { cn } from '@/lib/utils/common';
import type { VoteRecord } from '@/types/vote';

interface AlreadyVotedCardProps {
  /** Local vote record from localStorage. Null when the user voted on another
   *  device or cleared their browser data; in that case a simplified card is
   *  shown without choice/hash details. */
  record: VoteRecord | null;
}

export function AlreadyVotedCard({ record }: AlreadyVotedCardProps) {
  const [copied, setCopied] = useState(false);

  const copyHash = async () => {
    if (!record) {
      return;
    }
    try {
      await navigator.clipboard.writeText(record.ballotHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!record) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-bg p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-success">Ви вже проголосували</p>
            <p className="font-body mt-0.5 text-xs text-muted-foreground">
              Ваш голос зафіксовано системою
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-kpi-gray-mid" />
          <p className="font-body text-xs leading-relaxed text-muted-foreground">
            Деталі бюлетеня недоступні. Вони зберігаються локально в браузері, де ви голосували.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-bg p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15">
          <CheckCircle className="h-5 w-5 text-success" />
        </div>
        <div>
          <p className="font-body text-sm font-semibold text-success">Ви вже проголосували</p>
          <p className="font-body ph-no-capture mt-0.5 text-xs text-muted-foreground">
            <LocalDateTime date={record.votedAt} />
          </p>
        </div>
      </div>

      <div className="ph-no-capture">
        <p className="font-body mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {record.choiceLabels.length > 1 ? 'Ваші вибори' : 'Ваш вибір'}
        </p>
        <div className="space-y-2">
          {record.choiceLabels.map((label, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-lg p-4',
                'border-2 border-kpi-navy/20 bg-kpi-navy/5',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kpi-navy font-display text-base font-bold text-white">
                ✓
              </span>
              <span className="font-body min-w-0 font-semibold wrap-break-word text-kpi-navy">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-body mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Хеш вашого бюлетеня
        </p>
        <button
          onClick={copyHash}
          title="Натисніть, щоб скопіювати"
          className={cn(
            'group w-full cursor-pointer rounded-(--radius) border p-3 text-left transition-all duration-150',
            copied
              ? 'border-success/40 bg-success-bg shadow-xs'
              : 'border-border-subtle bg-surface hover:border-kpi-blue-light hover:bg-kpi-navy/3',
          )}
        >
          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 shrink-0 text-kpi-gray-mid" />
            <p className="ph-no-capture flex-1 font-mono text-sm leading-relaxed break-all text-foreground">
              {record.ballotHash}
            </p>
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                copied ? 'bg-success/15 text-success' : 'bg-kpi-navy/8 text-kpi-gray-mid',
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

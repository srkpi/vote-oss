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
    if (!record) return;
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
        <div className="border-success/30 bg-success-bg flex items-center gap-3 rounded-lg border p-4">
          <div className="bg-success/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <CheckCircle className="text-success h-5 w-5" />
          </div>
          <div>
            <p className="font-body text-success text-sm font-semibold">Ви вже проголосували</p>
            <p className="font-body text-muted-foreground mt-0.5 text-xs">
              Ваш голос зафіксовано системою
            </p>
          </div>
        </div>

        <div className="border-border-subtle bg-surface flex items-start gap-3 rounded-lg border p-4">
          <MonitorSmartphone className="text-kpi-gray-mid mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-body text-muted-foreground text-xs leading-relaxed">
            Деталі бюлетеня недоступні. Вони зберігаються локально в браузері, де ви голосували.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-success/30 bg-success-bg flex items-center gap-3 rounded-lg border p-4">
        <div className="bg-success/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <CheckCircle className="text-success h-5 w-5" />
        </div>
        <div>
          <p className="font-body text-success text-sm font-semibold">Ви вже проголосували</p>
          <p className="font-body text-muted-foreground ph-no-capture mt-0.5 text-xs">
            <LocalDateTime date={record.votedAt} />
          </p>
        </div>
      </div>

      <div className="ph-no-capture">
        <p className="font-body text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
          {record.choiceLabels.length > 1 ? 'Ваші вибори' : 'Ваш вибір'}
        </p>
        <div className="space-y-2">
          {record.choiceLabels.map((label, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-lg p-4',
                'border-kpi-navy/20 bg-kpi-navy/5 border-2',
              )}
            >
              <span className="navy-gradient font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white">
                ✓
              </span>
              <span className="font-body text-kpi-navy min-w-0 font-semibold wrap-break-word">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
          Хеш вашого бюлетеня
        </p>
        <button
          onClick={copyHash}
          title="Натисніть, щоб скопіювати"
          className={cn(
            'group w-full cursor-pointer rounded-(--radius) border p-3 text-left transition-all duration-150',
            copied
              ? 'border-success/40 bg-success-bg shadow-shadow-xs'
              : 'border-border-subtle bg-surface hover:border-kpi-blue-light hover:bg-kpi-navy/3',
          )}
        >
          <div className="flex items-center gap-2">
            <Hash className="text-kpi-gray-mid h-3.5 w-3.5 shrink-0" />
            <p className="ph-no-capture text-foreground flex-1 font-mono text-sm leading-relaxed break-all">
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

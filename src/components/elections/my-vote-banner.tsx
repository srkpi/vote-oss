import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDown, CheckCircle, UserCheck } from 'lucide-react';
import type { VoteRecord } from '@/types';
import { Button } from '@/components/ui/button';

interface MyVoteBannerProps {
  record: VoteRecord;
  found: boolean;
  decryptionDone: boolean;
  matchesDecryption: boolean | null;
  decryptedChoiceLabel: string | null;
  onScrollTo: () => void;
}

export function MyVoteBanner({
  record,
  found,
  decryptionDone,
  matchesDecryption,
  decryptedChoiceLabel,
  onScrollTo,
}: MyVoteBannerProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-xl)] border p-5',
        matchesDecryption === true && 'bg-[var(--success-bg)] border-[var(--success)]/30',
        matchesDecryption === false && 'bg-[var(--error-bg)] border-[var(--error)]/30',
        matchesDecryption === null && 'bg-[var(--info-bg)] border-[var(--kpi-blue-light)]/30',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-[var(--radius-lg)] flex items-center justify-center shrink-0',
            matchesDecryption === true && 'bg-[var(--success)]/15',
            matchesDecryption === false && 'bg-[var(--error)]/15',
            matchesDecryption === null && 'bg-[var(--kpi-blue-light)]/15',
          )}
        >
          {matchesDecryption === true ? (
            <CheckCircle className="w-5 h-5 text-[var(--success)]" />
          ) : matchesDecryption === false ? (
            <AlertTriangle className="w-5 h-5 text-[var(--error)]" />
          ) : (
            <UserCheck className="w-5 h-5 text-[var(--kpi-blue-light)]" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <p
            className={cn(
              'text-sm font-body font-semibold',
              matchesDecryption === true && 'text-[var(--success)]',
              matchesDecryption === false && 'text-[var(--error)]',
              matchesDecryption === null && 'text-[var(--kpi-blue-mid)]',
            )}
          >
            {matchesDecryption === true
              ? 'Ваш голос верифіковано'
              : matchesDecryption === false
                ? 'Розшифрований вибір відрізняється від локального запису!'
                : 'Ваш голос збережено локально'}
          </p>

          {/* Choice row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-body">
            <span className="text-[var(--muted-foreground)]">
              Збережений вибір:{' '}
              <strong className="text-[var(--foreground)]">{record.choiceLabel}</strong>
            </span>

            {decryptionDone && decryptedChoiceLabel && matchesDecryption === false && (
              <span className="text-[var(--error)]">
                Розшифровано: <strong>{decryptedChoiceLabel}</strong>
              </span>
            )}
          </div>

          {!found && (
            <p className="text-xs text-[var(--muted-foreground)] font-body flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--kpi-orange)]" />
              Бюлетень з таким хешем не знайдено на цій сторінці. Можливо, він ще не завантажений.
            </p>
          )}
        </div>

        {/* Scroll button */}
        {found && (
          <Button
            variant="secondary"
            onClick={onScrollTo}
            icon={<ArrowDown />}
            iconPosition="right"
          />
        )}
      </div>
    </div>
  );
}

import { AlertTriangle, ArrowDown, CheckCircle, UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VoteRecord } from '@/types/vote';

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
        'rounded-xl border p-5',
        matchesDecryption === true && 'border-success/30 bg-success-bg',
        matchesDecryption === false && 'border-error/30 bg-error-bg',
        matchesDecryption === null && 'border-kpi-blue-light/30 bg-info-bg',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            matchesDecryption === true && 'bg-success/15',
            matchesDecryption === false && 'bg-error/15',
            matchesDecryption === null && 'bg-kpi-blue-light/15',
          )}
        >
          {matchesDecryption === true ? (
            <CheckCircle className="text-success h-5 w-5" />
          ) : matchesDecryption === false ? (
            <AlertTriangle className="text-error h-5 w-5" />
          ) : (
            <UserCheck className="text-kpi-blue-light h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p
            className={cn(
              'font-body text-sm font-semibold',
              matchesDecryption === true && 'text-success',
              matchesDecryption === false && 'text-error',
              matchesDecryption === null && 'text-kpi-blue-mid',
            )}
          >
            {matchesDecryption === true
              ? 'Ваш голос верифіковано'
              : matchesDecryption === false
                ? 'Розшифрований вибір відрізняється від локального запису!'
                : 'Ваш голос збережено локально'}
          </p>

          <div className="font-body flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground min-w-0 wrap-break-word">
              Збережений вибір: <strong className="text-foreground">{record.choiceLabel}</strong>
            </span>

            {decryptionDone && decryptedChoiceLabel && matchesDecryption === false && (
              <span className="text-error wrap-break-word">
                Розшифровано: <strong>{decryptedChoiceLabel}</strong>
              </span>
            )}
          </div>

          {!found && (
            <p className="font-body text-muted-foreground flex items-center gap-1.5 text-xs">
              <AlertTriangle className="text-kpi-orange h-3.5 w-3.5" />
              Бюлетень з таким хешем не знайдено на цій сторінці. Можливо, він ще не завантажений.
            </p>
          )}
        </div>

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

import { Eye, EyeOff, Loader2, ShieldAlert, ShieldCheck, Unlock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DecryptionPanelProps {
  ballotCount: number;
  isDecrypting: boolean;
  decryptionDone: boolean;
  showDecrypted: boolean;
  malformedCount: number;
  invalidHashCount: number;
  onDecrypt: () => void;
  onToggleShow: () => void;
}

export function DecryptionPanel({
  ballotCount,
  isDecrypting,
  decryptionDone,
  showDecrypted,
  malformedCount,
  invalidHashCount,
  onDecrypt,
  onToggleShow,
}: DecryptionPanelProps) {
  const isClean = decryptionDone && malformedCount === 0 && invalidHashCount === 0;
  const hasProblem = decryptionDone && (malformedCount > 0 || invalidHashCount > 0);

  return (
    <div
      className={cn(
        'rounded-xl border p-5',
        isClean && 'border-(--success)/30 bg-(--success-bg)',
        hasProblem && 'border-(--error)/30 bg-(--error-bg)',
        !decryptionDone && 'border-(--kpi-orange)/30 bg-white',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              isClean && 'bg-(--success)/15',
              hasProblem && 'bg-(--error)/15',
              !decryptionDone && 'bg-(--kpi-orange)/15',
            )}
          >
            {isDecrypting ? (
              <Loader2 className="h-5 w-5 animate-spin text-(--kpi-navy)" />
            ) : isClean ? (
              <ShieldCheck className="h-5 w-5 text-(--success)" />
            ) : hasProblem ? (
              <ShieldAlert className="h-5 w-5 text-(--error)" />
            ) : (
              <Unlock className="h-5 w-5 text-(--kpi-orange)" />
            )}
          </div>

          <div className="min-w-0">
            {isDecrypting && (
              <p className="font-body text-sm font-medium text-(--foreground)">
                Розшифрування {ballotCount} бюлетенів…
              </p>
            )}
            {!isDecrypting && !decryptionDone && (
              <>
                <p className="font-body text-sm font-medium text-(--foreground)">
                  Розшифрувати бюлетені локально
                </p>
                <p className="font-body mt-0.5 text-xs text-(--muted-foreground)">
                  Голосування закрито — приватний ключ відкрито. Розшифрування відбувається у вашому
                  браузері, дані нікуди не передаються.
                </p>
              </>
            )}
            {decryptionDone && (
              <>
                <p
                  className={cn(
                    'font-body text-sm font-medium',
                    isClean ? 'text-(--success)' : 'text-(--error)',
                  )}
                >
                  {isClean
                    ? `Усі ${ballotCount} бюлетенів успішно розшифровано та верифіковано`
                    : `${malformedCount} зіпсованих · ${invalidHashCount} з некоректним хешем`}
                </p>
                <p className="font-body mt-0.5 text-xs text-(--muted-foreground)">
                  Розшифровано локально у вашому браузері
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {decryptionDone && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleShow}
              icon={
                showDecrypted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />
              }
            >
              {showDecrypted ? 'Сховати' : 'Показати'}
            </Button>
          )}
          {!decryptionDone && (
            <Button
              variant="accent"
              size="sm"
              onClick={onDecrypt}
              loading={isDecrypting}
              disabled={isDecrypting}
              icon={<Unlock className="h-3.5 w-3.5" />}
            >
              Розшифрувати
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

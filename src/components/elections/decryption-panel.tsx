import { Eye, EyeOff, Loader2, ShieldAlert, ShieldCheck, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
        'rounded-[var(--radius-xl)] border p-5 animate-fade-up',
        isClean && 'bg-[var(--success-bg)] border-[var(--success)]/30',
        hasProblem && 'bg-[var(--error-bg)] border-[var(--error)]/30',
        !decryptionDone && 'bg-white border-[var(--kpi-orange)]/30',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-[var(--radius-lg)] flex items-center justify-center shrink-0',
              isClean && 'bg-[var(--success)]/15',
              hasProblem && 'bg-[var(--error)]/15',
              !decryptionDone && 'bg-[var(--kpi-orange)]/15',
            )}
          >
            {isDecrypting ? (
              <Loader2 className="w-5 h-5 text-[var(--kpi-navy)] animate-spin" />
            ) : isClean ? (
              <ShieldCheck className="w-5 h-5 text-[var(--success)]" />
            ) : hasProblem ? (
              <ShieldAlert className="w-5 h-5 text-[var(--error)]" />
            ) : (
              <Unlock className="w-5 h-5 text-[var(--kpi-orange)]" />
            )}
          </div>

          <div className="min-w-0">
            {isDecrypting && (
              <p className="text-sm font-body font-medium text-[var(--foreground)]">
                Розшифрування {ballotCount} бюлетенів…
              </p>
            )}
            {!isDecrypting && !decryptionDone && (
              <>
                <p className="text-sm font-body font-medium text-[var(--foreground)]">
                  Розшифрувати бюлетені локально
                </p>
                <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5">
                  Голосування закрито — приватний ключ відкрито. Розшифрування відбувається у вашому
                  браузері, дані нікуди не передаються.
                </p>
              </>
            )}
            {decryptionDone && (
              <>
                <p
                  className={cn(
                    'text-sm font-body font-medium',
                    isClean ? 'text-[var(--success)]' : 'text-[var(--error)]',
                  )}
                >
                  {isClean
                    ? `Усі ${ballotCount} бюлетенів успішно розшифровано та верифіковано`
                    : `${malformedCount} зіпсованих · ${invalidHashCount} з некоректним хешем`}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5">
                  Розшифровано локально у вашому браузері
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {decryptionDone && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleShow}
              icon={
                showDecrypted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />
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
              icon={<Unlock className="w-3.5 h-3.5" />}
            >
              Розшифрувати
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

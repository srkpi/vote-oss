import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  LinkIcon,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { Ballot, DecryptionResult, ElectionChoice } from '@/types';

interface BallotRowProps {
  ballot: Ballot;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  decryption?: DecryptionResult;
  choices: ElectionChoice[];
}

export function BallotRow({ ballot, index, isExpanded, onToggle, decryption }: BallotRowProps) {
  const isMalformed = decryption !== undefined && !decryption.valid;
  const isBadHash = decryption !== undefined && !decryption.hashValid;
  const isAnomalous = isMalformed || isBadHash;

  return (
    <div className={cn('transition-colors duration-200', isAnomalous && 'bg-[var(--error-bg)]')}>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-5 py-4 text-left',
          'hover:bg-[var(--surface)] transition-colors duration-150',
          isAnomalous && 'hover:bg-[var(--error-bg)]/80',
        )}
      >
        <span className="w-8 text-xs font-body text-[var(--muted-foreground)] shrink-0 text-right tabular-nums">
          {index}
        </span>

        <span className="shrink-0">
          {isBadHash ? (
            <ShieldAlert className="w-4 h-4 text-[var(--error)]" />
          ) : isMalformed ? (
            <AlertTriangle className="w-4 h-4 text-[var(--error)]" />
          ) : decryption !== undefined ? (
            <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
          ) : (
            <LinkIcon className="w-4 h-4 text-[var(--kpi-gray-light)]" />
          )}
        </span>

        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="font-mono text-xs text-[var(--foreground)] truncate">
            {ballot.current_hash}
          </p>
          {decryption && (
            <p
              className={cn(
                'text-xs font-body font-medium',
                decryption.valid ? 'text-[var(--kpi-navy)]' : 'text-[var(--error)]',
              )}
            >
              {decryption.valid && decryption.choiceLabel ? (
                <>
                  <span className="text-[var(--muted-foreground)] font-normal">Вибір: </span>
                  {decryption.choiceLabel}
                </>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Неможливо розшифрувати або невалідний вибір
                </span>
              )}
            </p>
          )}
        </div>

        {isAnomalous && (
          <span className="shrink-0 text-[10px] font-semibold text-white bg-[var(--error)] px-2 py-0.5 rounded-full uppercase tracking-wide">
            {isBadHash ? 'Хеш ≠' : 'Зіпсований'}
          </span>
        )}

        <ChevronDown
          className={cn(
            'w-4 h-4 text-[var(--muted-foreground)] transition-transform duration-200 shrink-0',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded && (
        <div className="px-5 pb-4 border-t border-[var(--border-subtle)] bg-[var(--surface)]/50">
          <div className="pt-4 space-y-4 ml-[52px]">
            {decryption && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                  Розшифрований вибір
                </p>
                <div
                  className={cn(
                    'p-3 rounded-[var(--radius)] border flex items-center gap-2',
                    decryption.valid
                      ? 'bg-[var(--success-bg)] border-[var(--success)]/30'
                      : 'bg-[var(--error-bg)] border-[var(--error)]/30',
                  )}
                >
                  {decryption.valid ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-[var(--success)] shrink-0" />
                      <div>
                        <p className="text-sm font-body font-semibold text-[var(--foreground)]">
                          {decryption.choiceLabel}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] font-body">
                          ID варіанту: {decryption.choiceId}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-[var(--error)] shrink-0" />
                      <p className="text-sm font-body text-[var(--error)]">
                        Бюлетень не вдалося розшифрувати або він містить невалідний ID
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {decryption && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                  Цілісність хешу
                </p>
                <div
                  className={cn(
                    'p-3 rounded-[var(--radius)] border flex items-center gap-2',
                    decryption.hashValid
                      ? 'bg-[var(--success-bg)] border-[var(--success)]/30'
                      : 'bg-[var(--error-bg)] border-[var(--error)]/30',
                  )}
                >
                  {decryption.hashValid ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[var(--success)] shrink-0" />
                      <p className="text-xs font-body text-[var(--success)]">
                        SHA-256 збігається — бюлетень не змінювався
                      </p>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 text-[var(--error)] shrink-0" />
                      <p className="text-xs font-body text-[var(--error)]">
                        SHA-256 НЕ збігається — можливе втручання
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                Зашифрований бюлетень
              </p>
              <div className="p-3 bg-white rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-x-auto">
                <p className="font-mono text-[10px] text-[var(--foreground)] break-all leading-relaxed">
                  {ballot.encrypted_ballot}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                Підпис
              </p>
              <div className="p-3 bg-white rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-x-auto">
                <p className="font-mono text-[10px] text-[var(--foreground)] break-all leading-relaxed">
                  {ballot.signature}
                </p>
              </div>
            </div>

            {ballot.previous_hash && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                  Попередній хеш
                </p>
                <div className="p-3 bg-white rounded-[var(--radius)] border border-[var(--border-subtle)]">
                  <p className="font-mono text-[10px] text-[var(--foreground)] break-all">
                    {ballot.previous_hash}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  LinkIcon,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Ballot, DecryptionResult } from '@/types/ballot';
import { ElectionChoice } from '@/types/election';

interface BallotRowProps {
  ballot: Ballot;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  decryption?: DecryptionResult;
  choices: ElectionChoice[];
  isMyBallot?: boolean;
  myStoredChoiceLabel?: string;
}

export function BallotRow({
  ballot,
  index,
  isExpanded,
  onToggle,
  decryption,
  isMyBallot = false,
  myStoredChoiceLabel,
}: BallotRowProps) {
  const isMalformed = decryption !== undefined && !decryption.valid;
  const isBadHash = decryption !== undefined && !decryption.hashValid;
  const isAnomalous = isMalformed || isBadHash;

  // Compare locally-stored choice with the decrypted one
  const myChoiceVerified =
    isMyBallot && decryption !== undefined && myStoredChoiceLabel !== undefined
      ? decryption.valid && decryption.choiceLabel === myStoredChoiceLabel
      : null;

  return (
    <div
      className={cn(
        'transition-colors duration-200',
        isMyBallot && 'bg-(--info-bg)/40',
        isAnomalous && 'bg-(--error-bg)',
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 px-5 py-4 text-left',
          'transition-colors duration-150 hover:bg-(--surface)',
          isAnomalous && 'hover:bg-(--error-bg)/80',
          isMyBallot && !isAnomalous && 'hover:bg-(--info-bg)/60',
        )}
      >
        <span className="font-body w-8 shrink-0 text-right text-xs text-(--muted-foreground) tabular-nums">
          {index}
        </span>

        <span className="shrink-0">
          {isBadHash ? (
            <ShieldAlert className="h-4 w-4 text-(--error)" />
          ) : isMalformed ? (
            <AlertTriangle className="h-4 w-4 text-(--error)" />
          ) : decryption !== undefined ? (
            <ShieldCheck className="h-4 w-4 text-(--success)" />
          ) : (
            <LinkIcon className="h-4 w-4 text-(--kpi-gray-light)" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-mono text-xs text-(--foreground)">{ballot.currentHash}</p>
          {decryption && (
            <p
              className={cn(
                'font-body text-xs font-medium',
                decryption.valid ? 'text-(--kpi-navy)' : 'text-(--error)',
              )}
            >
              {decryption.valid && decryption.choiceLabel ? (
                <>
                  <span className="font-normal text-(--muted-foreground)">Вибір: </span>
                  {decryption.choiceLabel}
                </>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Неможливо розшифрувати або невалідний вибір
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isMyBallot && (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase',
                myChoiceVerified === true && 'bg-(--success)',
                myChoiceVerified === false && 'bg-(--error)',
                myChoiceVerified === null && 'bg-(--kpi-blue-light)',
              )}
            >
              <UserCheck className="h-3 w-3" />
              {myChoiceVerified === true
                ? 'Верифіковано'
                : myChoiceVerified === false
                  ? 'Розбіжність!'
                  : 'Ви'}
            </span>
          )}

          {isAnomalous && (
            <span className="rounded-full bg-(--error) px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
              {isBadHash ? 'Хеш ≠' : 'Зіпсований'}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-(--muted-foreground) transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-(--border-subtle) bg-(--surface)/50 px-5 pb-4">
          <div className="ml-13 space-y-4 pt-4">
            {isMyBallot && (
              <div>
                <p className="font-body mb-1.5 text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
                  Верифікація вашого голосу
                </p>
                {myChoiceVerified === null ? (
                  <div className="flex items-center gap-2 rounded-(--radius) border border-(--kpi-blue-light)/30 bg-(--info-bg) p-3">
                    <UserCheck className="h-4 w-4 shrink-0 text-(--kpi-blue-light)" />
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold wrap-break-word text-(--foreground)">
                        Ваш збережений вибір: {myStoredChoiceLabel}
                      </p>
                      <p className="font-body mt-0.5 text-xs text-(--muted-foreground)">
                        Розшифруйте бюлетені, щоб верифікувати
                      </p>
                    </div>
                  </div>
                ) : myChoiceVerified === true ? (
                  <div className="flex items-center gap-2 rounded-(--radius) border border-(--success)/30 bg-(--success-bg) p-3">
                    <CheckCircle className="h-4 w-4 shrink-0 text-(--success)" />
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-(--success)">
                        Голос верифіковано
                      </p>
                      <p className="font-body mt-0.5 text-xs wrap-break-word text-(--muted-foreground)">
                        Розшифрований вибір збігається з локальним записом:{' '}
                        <strong>{myStoredChoiceLabel}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-(--radius) border border-(--error)/30 bg-(--error-bg) p-3">
                    <XCircle className="h-4 w-4 shrink-0 text-(--error)" />
                    <div>
                      <p className="font-body text-sm font-semibold text-(--error)">
                        Розбіжність виборів!
                      </p>
                      <p className="font-body mt-0.5 text-xs wrap-break-word text-(--muted-foreground)">
                        Збережено: <strong>{myStoredChoiceLabel}</strong> · Розшифровано:{' '}
                        <strong>{decryption?.choiceLabel ?? '?'}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {decryption && (
              <div>
                <p className="font-body mb-1.5 text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
                  Розшифрований вибір
                </p>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-(--radius) border p-3',
                    decryption.valid
                      ? 'border-(--success)/30 bg-(--success-bg)'
                      : 'border-(--error)/30 bg-(--error-bg)',
                  )}
                >
                  {decryption.valid ? (
                    <>
                      <CheckCircle className="h-4 w-4 shrink-0 text-(--success)" />
                      <div>
                        <p className="font-body text-sm font-semibold text-(--foreground)">
                          {decryption.choiceLabel}
                        </p>
                        <p className="font-body text-xs text-(--muted-foreground)">
                          ID варіанту: {decryption.choiceId}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 shrink-0 text-(--error)" />
                      <p className="font-body text-sm text-(--error)">
                        Бюлетень не вдалося розшифрувати або він містить невалідний ID
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {decryption && (
              <div>
                <p className="font-body mb-1.5 text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
                  Цілісність хешу
                </p>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-(--radius) border p-3',
                    decryption.hashValid
                      ? 'border-(--success)/30 bg-(--success-bg)'
                      : 'border-(--error)/30 bg-(--error-bg)',
                  )}
                >
                  {decryption.hashValid ? (
                    <>
                      <ShieldCheck className="h-4 w-4 shrink-0 text-(--success)" />
                      <p className="font-body text-xs text-(--success)">
                        SHA-256 збігається — бюлетень не змінювався
                      </p>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 shrink-0 text-(--error)" />
                      <p className="font-body text-xs text-(--error)">
                        SHA-256 НЕ збігається — можливе втручання
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="font-body mb-1.5 text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
                Зашифрований бюлетень
              </p>
              <div className="overflow-x-auto rounded-(--radius) border border-(--border-subtle) bg-white p-3">
                <p className="font-mono text-[10px] leading-relaxed break-all text-(--foreground)">
                  {ballot.encryptedBallot}
                </p>
              </div>
            </div>

            <div>
              <p className="font-body mb-1.5 text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
                Підпис
              </p>
              <div className="overflow-x-auto rounded-(--radius) border border-(--border-subtle) bg-white p-3">
                <p className="font-mono text-[10px] leading-relaxed break-all text-(--foreground)">
                  {ballot.signature}
                </p>
              </div>
            </div>

            {ballot.previousHash && (
              <div>
                <p className="font-body mb-1.5 text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
                  Попередній хеш
                </p>
                <div className="rounded-(--radius) border border-(--border-subtle) bg-white p-3">
                  <p className="font-mono text-[10px] break-all text-(--foreground)">
                    {ballot.previousHash}
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

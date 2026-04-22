import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  LinkIcon,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  Vote,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils/common';
import type { Ballot, DecryptionResult } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';

interface BallotRowProps {
  ballot: Ballot;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  decryption?: DecryptionResult;
  choices: ElectionChoice[];
  isMyBallot?: boolean;
  myStoredChoiceLabels?: string[];
}

export function BallotRow({
  ballot,
  index,
  isExpanded,
  onToggle,
  decryption,
  choices,
  isMyBallot = false,
  myStoredChoiceLabels,
}: BallotRowProps) {
  const isMalformed = decryption !== undefined && !decryption.valid;
  const isBadHash = decryption !== undefined && !decryption.hashValid;
  const isAnomalous = isMalformed || isBadHash;

  // Compare locally-stored choice with the decrypted one
  const myChoiceVerified =
    isMyBallot && decryption !== undefined && myStoredChoiceLabels !== undefined
      ? decryption.valid &&
        decryption.choiceLabels?.length === myStoredChoiceLabels.length &&
        decryption.choiceLabels.every((l) => myStoredChoiceLabels.includes(l))
      : null;

  return (
    <div
      className={cn(
        'transition-colors duration-200',
        isMyBallot && 'bg-info-bg/40',
        isAnomalous && 'bg-error-bg',
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 px-5 py-4 text-left',
          'hover:bg-surface transition-colors duration-150',
          isAnomalous && 'hover:bg-error-bg/80',
          isMyBallot && !isAnomalous && 'hover:bg-info-bg/60',
        )}
      >
        <span className="font-body text-muted-foreground shrink-0 text-xs">{index}</span>
        <span className="shrink-0">
          {isBadHash ? (
            <ShieldAlert className="text-error h-4 w-4" />
          ) : isMalformed ? (
            <AlertTriangle className="text-error h-4 w-4" />
          ) : decryption !== undefined ? (
            <ShieldCheck className="text-success h-4 w-4" />
          ) : (
            <LinkIcon className="text-kpi-gray-light h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-foreground truncate font-mono text-xs">{ballot.currentHash}</p>
          {decryption && (!decryption.valid || choices.length > 1) && (
            <p
              className={cn(
                'font-body text-xs font-medium',
                decryption.valid ? 'text-muted-foreground' : 'text-error',
              )}
            >
              {decryption.valid && decryption.choiceLabels ? (
                <>
                  <Vote className="mr-1 inline h-3 w-3" />
                  {decryption.choiceLabels.join(', ')}
                </>
              ) : (
                <span className="flex items-center gap-1">
                  Неможливо розшифрувати або невалідний вибір
                </span>
              )}
            </p>
          )}
          {decryption?.voter && (
            <p className="font-body text-muted-foreground truncate text-xs">
              <User className="mr-1 inline h-3 w-3" />
              {decryption.voter.fullName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isMyBallot && (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase',
                myChoiceVerified === true && 'bg-success',
                myChoiceVerified === false && 'bg-error',
                myChoiceVerified === null && 'bg-kpi-blue-light',
              )}
            >
              <UserCheck className="h-3 w-3" />
              {myChoiceVerified === true
                ? 'Верифіковано'
                : myChoiceVerified === false
                  ? 'Розбіжність'
                  : 'Ви'}
            </span>
          )}

          {isAnomalous && (
            <span className="bg-error rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
              {isBadHash ? 'Хеш ≠' : 'Зіпсований'}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded && (
        <div className="border-border-subtle bg-surface/50 border-t px-5 pb-4">
          <div className="space-y-4 pt-4">
            {isMyBallot && (
              <div>
                <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Верифікація вашого голосу
                </p>
                {myChoiceVerified === null ? (
                  <div className="border-kpi-blue-light/30 bg-info-bg flex items-center gap-2 rounded-(--radius) border p-3">
                    <UserCheck className="text-kpi-blue-light h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-body text-foreground text-sm font-semibold wrap-break-word">
                        Ваш збережений вибір: {myStoredChoiceLabels?.join(', ')}
                      </p>
                      <p className="font-body text-muted-foreground mt-0.5 text-xs">
                        Розшифруйте бюлетені, щоб верифікувати
                      </p>
                    </div>
                  </div>
                ) : myChoiceVerified === true ? (
                  <div className="border-success/30 bg-success-bg flex items-center gap-2 rounded-(--radius) border p-3">
                    <CheckCircle className="text-success h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-body text-success text-sm font-semibold">
                        Голос верифіковано
                      </p>
                      <p className="font-body text-muted-foreground mt-0.5 text-xs wrap-break-word">
                        Розшифрований вибір збігається з локальним записом:{' '}
                        <strong>{myStoredChoiceLabels?.join(', ')}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border-error/30 bg-error-bg flex items-center gap-2 rounded-(--radius) border p-3">
                    <XCircle className="text-error h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-body text-error text-sm font-semibold">
                        Розбіжність виборів!
                      </p>
                      <p className="font-body text-muted-foreground mt-0.5 text-xs wrap-break-word">
                        Збережено: <strong>{myStoredChoiceLabels?.join(', ')}</strong> ·
                        Розшифровано: <strong>{decryption?.choiceLabels?.join(', ') ?? '?'}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {decryption?.voter && (
              <div>
                <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Голосуючий
                </p>
                <div className="border-kpi-blue-light/30 bg-info-bg flex items-center gap-2 rounded-(--radius) border p-3">
                  <User className="text-kpi-blue-light h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-body text-foreground text-sm font-semibold wrap-break-word">
                      {decryption.voter.fullName}
                    </p>
                    <p className="font-body text-muted-foreground mt-0.5 font-mono text-[10px] break-all">
                      ID: {decryption.voter.userId}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {decryption && (!decryption.valid || choices.length > 1) && (
              <div>
                <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Розшифрований вибір
                </p>

                {decryption.valid && choices.length > 1 && (
                  <div className="border-success/30 bg-success-bg flex items-center gap-2 rounded-(--radius) border p-3">
                    <CheckCircle className="text-success h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-body text-foreground text-sm font-semibold wrap-break-word">
                        {decryption.choiceLabels?.join(', ')}
                      </p>
                      <p className="font-body text-muted-foreground text-xs wrap-break-word">
                        ID{' '}
                        {decryption.choiceIds?.length && decryption.choiceIds?.length > 1
                          ? 'варіантів'
                          : 'варіанту'}
                        : {decryption.choiceIds?.join(', ')}
                      </p>
                    </div>
                  </div>
                )}

                {!decryption.valid && (
                  <div className="border-error/30 bg-error-bg flex items-center gap-2 rounded-(--radius) border p-3">
                    <XCircle className="text-error h-4 w-4 shrink-0" />
                    <p className="font-body text-error text-sm">
                      Бюлетень не вдалося розшифрувати або він містить невалідний ID
                    </p>
                  </div>
                )}
              </div>
            )}

            {decryption && (
              <div>
                <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Цілісність хешу
                </p>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-(--radius) border p-3',
                    decryption.hashValid
                      ? 'border-success/30 bg-success-bg'
                      : 'border-error/30 bg-error-bg',
                  )}
                >
                  {decryption.hashValid ? (
                    <>
                      <ShieldCheck className="text-success h-4 w-4 shrink-0" />
                      <p className="font-body text-success text-xs">
                        SHA-256 збігається — бюлетень не змінювався
                      </p>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="text-error h-4 w-4 shrink-0" />
                      <p className="font-body text-error text-xs">
                        SHA-256 НЕ збігається — можливе втручання
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                Зашифрований бюлетень
              </p>
              <div className="border-border-subtle overflow-x-auto rounded-(--radius) border bg-white p-3">
                <p className="text-foreground font-mono text-[10px] leading-relaxed break-all">
                  {ballot.encryptedBallot}
                </p>
              </div>
            </div>

            <div>
              <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                Підпис
              </p>
              <div className="border-border-subtle overflow-x-auto rounded-(--radius) border bg-white p-3">
                <p className="text-foreground font-mono text-[10px] leading-relaxed break-all">
                  {ballot.signature}
                </p>
              </div>
            </div>

            {ballot.previousHash && (
              <div>
                <p className="font-body text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Попередній хеш
                </p>
                <div className="border-border-subtle rounded-(--radius) border bg-white p-3">
                  <p className="text-foreground font-mono text-[10px] break-all">
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

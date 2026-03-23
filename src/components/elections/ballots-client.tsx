'use client';

import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BallotRow } from '@/components/elections/ballot-row';
import { DecryptionPanel } from '@/components/elections/decryption-panel';
import { MyVoteBanner } from '@/components/elections/my-vote-banner';
import { Button } from '@/components/ui/button';
import { decryptBallotData, importPrivateKey, verifyBallotHash } from '@/lib/crypto';
import { cn, pluralize } from '@/lib/utils';
import { getVote } from '@/lib/vote-storage';
import type { BallotsResponse, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice, ElectionDetail } from '@/types/election';
import type { VoteRecord } from '@/types/vote';

interface BallotsClientProps {
  initialData: BallotsResponse;
  election?: ElectionDetail | null;
}

const PAGE_SIZE = 20;

export function BallotsClient({ initialData, election }: BallotsClientProps) {
  const { ballots, election: electionMeta } = initialData;

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [decryptedMap, setDecryptedMap] = useState<DecryptedMap>(new Map());
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionDone, setDecryptionDone] = useState(false);
  const [showDecrypted, setShowDecrypted] = useState(true);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);

  const [myVoteRecord, setMyVoteRecord] = useState<VoteRecord | null>(null);
  const myBallotRef = useRef<HTMLDivElement | null>(null);

  const isClosed = election?.status === 'closed';
  const privateKey = election?.privateKey;
  const canDecrypt = isClosed && !!privateKey;
  const choices: ElectionChoice[] = election?.choices ?? [];
  const electionId = election?.id ?? electionMeta.id;

  useEffect(() => {
    const record = getVote(electionId);
    setMyVoteRecord(record);
  }, [electionId]);

  const handleDecryptAll = async () => {
    if (!privateKey) return;
    setIsDecrypting(true);
    try {
      if (!cryptoKeyRef.current) {
        cryptoKeyRef.current = await importPrivateKey(privateKey);
      }
      const key = cryptoKeyRef.current;
      const map: DecryptedMap = new Map();

      const BATCH = 8;
      for (let i = 0; i < ballots.length; i += BATCH) {
        await Promise.all(
          ballots.slice(i, i + BATCH).map(async (ballot) => {
            const [decryptedRaw, hashValid] = await Promise.all([
              decryptBallotData(key, ballot.encryptedBallot),
              verifyBallotHash(ballot, electionId),
            ]);
            let choiceId: string | null = null;
            let choiceLabel: string | null = null;
            let valid = false;
            if (decryptedRaw !== null) {
              const match = choices.find((c) => c.id === decryptedRaw);
              if (match) {
                choiceId = decryptedRaw;
                choiceLabel = match.choice;
                valid = true;
              }
            }
            map.set(ballot.id, { choiceId, choiceLabel, valid, hashValid });
          }),
        );
        await new Promise((r) => setTimeout(r, 0));
      }
      setDecryptedMap(map);
      setDecryptionDone(true);
    } catch (err) {
      console.error('[crypto] Decryption failed', err);
    } finally {
      setIsDecrypting(false);
    }
  };

  // After decryption completes, scroll to user's ballot if it's on screen
  useEffect(() => {
    if (decryptionDone && myBallotRef.current) {
      myBallotRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [decryptionDone]);

  const trimmedQuery = searchQuery.trim();
  const filteredBallots = useMemo(() => {
    if (!trimmedQuery) return ballots;
    const q = trimmedQuery.toLowerCase();
    return ballots.filter(
      (b) =>
        b.currentHash.includes(q) ||
        (decryptionDone &&
          (decryptedMap.get(b.id)?.choiceLabel?.toLowerCase().includes(q) ?? false)),
    );
  }, [ballots, trimmedQuery, decryptionDone, decryptedMap]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredBallots.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedBallots = filteredBallots.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (!myVoteRecord) return;
    const idx = filteredBallots.findIndex((b) => b.currentHash === myVoteRecord.ballotHash);
    if (idx !== -1) {
      setPage(Math.floor(idx / PAGE_SIZE) + 1);
    }
  }, [myVoteRecord, filteredBallots]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const malformedCount = decryptionDone
    ? [...decryptedMap.values()].filter((v) => !v.valid).length
    : 0;
  const invalidHashCount = decryptionDone
    ? [...decryptedMap.values()].filter((v) => !v.hashValid).length
    : 0;

  const myBallot = myVoteRecord
    ? (ballots.find((b) => b.currentHash === myVoteRecord.ballotHash) ?? null)
    : null;

  const myDecryption = myBallot && decryptionDone ? decryptedMap.get(myBallot.id) : undefined;
  const myVoteMatchesDecryption =
    myDecryption !== undefined && myVoteRecord !== null
      ? myDecryption.valid && myDecryption.choiceId === myVoteRecord.choiceId
      : null;

  return (
    <div className="space-y-5">
      {myVoteRecord && (
        <MyVoteBanner
          record={myVoteRecord}
          found={myBallot !== null}
          decryptionDone={decryptionDone}
          matchesDecryption={myVoteMatchesDecryption}
          decryptedChoiceLabel={myDecryption?.choiceLabel ?? null}
          onScrollTo={() =>
            myBallotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        />
      )}

      {canDecrypt && (
        <DecryptionPanel
          ballotCount={ballots.length}
          isDecrypting={isDecrypting}
          decryptionDone={decryptionDone}
          showDecrypted={showDecrypted}
          malformedCount={malformedCount}
          invalidHashCount={invalidHashCount}
          onDecrypt={handleDecryptAll}
          onToggleShow={() => setShowDecrypted((v) => !v)}
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="font-body text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
          <FileText className="text-kpi-gray-mid h-4 w-4" />
          <span>
            {trimmedQuery
              ? `Знайдено ${pluralize(filteredBallots.length, ['бюлетень', 'бюлетені', 'бюлетенів'])} з ${ballots.length}`
              : pluralize(ballots.length, ['бюлетень', 'бюлетені', 'бюлетенів'])}
          </span>
        </div>

        <div className="relative max-w-md flex-1">
          <div className="text-kpi-gray-mid pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={
              decryptionDone
                ? 'Пошук за хешем або варіантом відповіді…'
                : 'Пошук за хешем бюлетеня…'
            }
            className={cn(
              'h-9 w-full pr-9 pl-9 font-mono text-sm',
              'border-border-color rounded-lg border bg-white',
              'placeholder:font-body placeholder:text-subtle',
              'focus:border-kpi-blue-light focus:ring-kpi-blue-light/20 focus:ring-2 focus:outline-none',
              'shadow-shadow-xs transition-colors duration-150',
            )}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {trimmedQuery && (
        <div
          className={cn(
            'font-body rounded-lg border p-4 text-sm',
            filteredBallots.length > 0
              ? 'border-success/30 bg-success-bg text-success'
              : 'border-error/30 bg-error-bg text-error',
          )}
        >
          {filteredBallots.length > 0 ? (
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Знайдено {pluralize(filteredBallots.length, [
                'бюлетень',
                'бюлетені',
                'бюлетенів',
              ])} з {ballots.length}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              Жодного бюлетеня не знайдено серед {ballots.length}
            </span>
          )}
        </div>
      )}

      {ballots.length === 0 ? (
        <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-12 text-center">
          <div className="border-border-subtle bg-surface mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border">
            <FileText className="text-kpi-gray-mid h-7 w-7" />
          </div>
          <p className="font-display text-foreground text-lg font-semibold">Бюлетенів поки немає</p>
          <p className="font-body text-muted-foreground mt-1 text-sm">Голосів ще не подано</p>
        </div>
      ) : pagedBallots.length === 0 ? (
        <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-12 text-center">
          <p className="font-display text-foreground text-lg font-semibold">Нічого не знайдено</p>
          <p className="font-body text-muted-foreground mt-1 text-sm">
            Спробуйте змінити пошуковий запит
          </p>
        </div>
      ) : (
        <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
          {decryptionDone && invalidHashCount > 0 && (
            <div className="font-body border-error/20 bg-error-bg text-error flex items-center gap-2 border-b px-5 py-3 text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                <strong>{invalidHashCount}</strong> бюлетень(ів) мають некоректний хеш — можливе
                втручання в ланцюжок
              </span>
            </div>
          )}
          {decryptionDone && invalidHashCount === 0 && (
            <div className="font-body border-success/20 bg-success-bg text-success flex items-center gap-2 border-b px-5 py-3 text-sm">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Ланцюжок бюлетенів цілісний — усі хеші вірні</span>
            </div>
          )}

          <div className="divide-border-subtle divide-y">
            {pagedBallots.map((ballot, index) => {
              const isMyBallot =
                myVoteRecord !== null && ballot.currentHash === myVoteRecord.ballotHash;
              return (
                <div
                  key={ballot.id}
                  ref={isMyBallot ? myBallotRef : undefined}
                  className={cn(
                    isMyBallot && 'ring-kpi-blue-light relative rounded-none ring-2 ring-inset',
                  )}
                >
                  <BallotRow
                    ballot={ballot}
                    index={(safePage - 1) * PAGE_SIZE + index + 1}
                    isExpanded={expandedIds.has(ballot.id)}
                    onToggle={() => toggleExpand(ballot.id)}
                    decryption={
                      decryptionDone && showDecrypted ? decryptedMap.get(ballot.id) : undefined
                    }
                    choices={choices}
                    isMyBallot={isMyBallot}
                    myStoredChoiceLabel={isMyBallot ? myVoteRecord!.choiceLabel : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between py-2">
          <p className="font-body text-muted-foreground text-sm">
            Сторінка {safePage} з {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Назад
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (safePage <= 3) p = i + 1;
                else if (safePage >= totalPages - 2) p = totalPages - 4 + i;
                else p = safePage - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'font-body h-8 w-8 rounded-(--radius) text-sm font-medium transition-all duration-150',
                      p === safePage
                        ? 'bg-kpi-navy shadow-shadow-sm text-white'
                        : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              icon={<ChevronRight className="h-4 w-4" />}
              iconPosition="right"
            >
              Вперед
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

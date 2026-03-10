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
import { cn } from '@/lib/utils';
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
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [decryptedMap, setDecryptedMap] = useState<DecryptedMap>(new Map());
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionDone, setDecryptionDone] = useState(false);
  const [showDecrypted, setShowDecrypted] = useState(true);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);

  // ── User's stored vote record ──────────────────────────────────────────────
  const [myVoteRecord, setMyVoteRecord] = useState<VoteRecord | null>(null);
  const myBallotRef = useRef<HTMLDivElement | null>(null);

  const isClosed = election?.status === 'closed';
  const privateKey = election?.privateKey;
  const canDecrypt = isClosed && !!privateKey;
  const choices: ElectionChoice[] = election?.choices ?? [];
  const electionId = election?.id ?? electionMeta.id;

  // Load stored vote on mount
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
              decryptBallotData(key, ballot.encrypted_ballot),
              verifyBallotHash(ballot, electionId),
            ]);
            let choiceId: number | null = null;
            let choiceLabel: string | null = null;
            let valid = false;
            if (decryptedRaw !== null) {
              const parsed = parseInt(decryptedRaw, 10);
              if (!isNaN(parsed)) {
                choiceId = parsed;
                const match = choices.find((c) => c.id === parsed);
                if (match) {
                  choiceLabel = match.choice;
                  valid = true;
                }
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
      console.error('Decryption failed', err);
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
        b.current_hash.includes(q) ||
        (decryptionDone &&
          (decryptedMap.get(b.id)?.choiceLabel?.toLowerCase().includes(q) ?? false)),
    );
  }, [ballots, trimmedQuery, decryptionDone, decryptedMap]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // ── Local pagination ──────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredBallots.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedBallots = filteredBallots.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Jump to the page that contains the user's ballot on first load
  useEffect(() => {
    if (!myVoteRecord) return;
    const idx = filteredBallots.findIndex((b) => b.current_hash === myVoteRecord.ballotHash);
    if (idx !== -1) {
      setPage(Math.floor(idx / PAGE_SIZE) + 1);
    }
  }, [myVoteRecord, filteredBallots]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const malformedCount = decryptionDone
    ? [...decryptedMap.values()].filter((v) => !v.valid).length
    : 0;
  const invalidHashCount = decryptionDone
    ? [...decryptedMap.values()].filter((v) => !v.hashValid).length
    : 0;

  // ── My ballot lookup ──────────────────────────────────────────────────────
  const myBallot = myVoteRecord
    ? (ballots.find((b) => b.current_hash === myVoteRecord.ballotHash) ?? null)
    : null;

  // Verify stored choice matches decrypted choice
  const myDecryption = myBallot && decryptionDone ? decryptedMap.get(myBallot.id) : undefined;
  const myVoteMatchesDecryption =
    myDecryption !== undefined && myVoteRecord !== null
      ? myDecryption.valid && myDecryption.choiceId === myVoteRecord.choiceId
      : null;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* My Vote Banner */}
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] shrink-0">
          <FileText className="w-4 h-4 text-[var(--kpi-gray-mid)]" />
          <span>
            {trimmedQuery
              ? `${filteredBallots.length} з ${ballots.length} бюлетенів`
              : `${ballots.length} бюлетенів`}
          </span>
        </div>

        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kpi-gray-mid)] pointer-events-none">
            <Search className="w-4 h-4" />
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
              'w-full h-9 pl-9 pr-9 text-sm font-mono',
              'bg-white border border-[var(--border-color)] rounded-[var(--radius-lg)]',
              'placeholder:text-[var(--subtle)] placeholder:font-body',
              'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
              'transition-colors duration-150 shadow-[var(--shadow-xs)]',
            )}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {trimmedQuery && (
        <div
          className={cn(
            'p-4 rounded-[var(--radius-lg)] border text-sm font-body',
            filteredBallots.length > 0
              ? 'bg-[var(--success-bg)] border-[var(--success)]/30 text-[var(--success)]'
              : 'bg-[var(--error-bg)] border-[var(--error)]/30 text-[var(--error)]',
          )}
        >
          {filteredBallots.length > 0 ? (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Знайдено {filteredBallots.length} бюлетень(ів) серед {ballots.length}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              Жодного бюлетеня не знайдено серед {ballots.length}
            </span>
          )}
        </div>
      )}

      {ballots.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-[var(--kpi-gray-mid)]" />
          </div>
          <p className="font-display text-lg font-semibold text-[var(--foreground)]">
            Бюлетенів поки немає
          </p>
          <p className="text-sm text-[var(--muted-foreground)] font-body mt-1">
            Голосів ще не подано
          </p>
        </div>
      ) : pagedBallots.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-12 text-center">
          <p className="font-display text-lg font-semibold text-[var(--foreground)]">
            Нічого не знайдено
          </p>
          <p className="text-sm text-[var(--muted-foreground)] font-body mt-1">
            Спробуйте змінити пошуковий запит
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
          {/* Chain integrity banner */}
          {decryptionDone && invalidHashCount > 0 && (
            <div className="px-5 py-3 bg-[var(--error-bg)] border-b border-[var(--error)]/20 flex items-center gap-2 text-sm font-body text-[var(--error)]">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                <strong>{invalidHashCount}</strong> бюлетень(ів) мають некоректний хеш — можливе
                втручання в ланцюжок
              </span>
            </div>
          )}
          {decryptionDone && invalidHashCount === 0 && (
            <div className="px-5 py-3 bg-[var(--success-bg)] border-b border-[var(--success)]/20 flex items-center gap-2 text-sm font-body text-[var(--success)]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Ланцюжок бюлетенів цілісний — усі хеші вірні</span>
            </div>
          )}

          <div className="divide-y divide-[var(--border-subtle)]">
            {pagedBallots.map((ballot, index) => {
              const isMyBallot =
                myVoteRecord !== null && ballot.current_hash === myVoteRecord.ballotHash;
              return (
                <div
                  key={ballot.id}
                  ref={isMyBallot ? myBallotRef : undefined}
                  className={cn(
                    isMyBallot &&
                      'ring-2 ring-inset ring-[var(--kpi-blue-light)] rounded-none relative',
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
          <p className="text-sm text-[var(--muted-foreground)] font-body">
            Сторінка {safePage} з {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              icon={<ChevronLeft className="w-4 h-4" />}
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
                      'w-8 h-8 rounded-[var(--radius)] text-sm font-body font-medium transition-all duration-150',
                      p === safePage
                        ? 'bg-[var(--kpi-navy)] text-white shadow-[var(--shadow-sm)]'
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
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
              icon={<ChevronRight className="w-4 h-4" />}
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

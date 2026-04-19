'use client';

import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  CircleSlash2,
  FileText,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { AnalyticsPanel } from '@/components/elections/analytics/analytics-panel';
import { BallotRow } from '@/components/elections/ballot-row';
import { DecryptionPanel } from '@/components/elections/decryption-panel';
import { MyVoteBanner } from '@/components/elections/my-vote-banner';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import type { Tab } from '@/components/ui/tabs';
import { Tabs } from '@/components/ui/tabs';
import { decryptBallotData, importPrivateKey, verifyBallotHash } from '@/lib/crypto';
import { cn, pluralize } from '@/lib/utils/common';
import { getVote } from '@/lib/vote-storage';
import type { BallotsResponse, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';
import type { VoteRecord } from '@/types/vote';

interface BallotsClientProps {
  initialData: BallotsResponse;
}

const PAGE_SIZE = 20;

type ActiveTab = 'ballots' | 'analytics';

const tabs: Tab<ActiveTab>[] = [
  { key: 'ballots', label: 'Бюлетені', icon: <FileText className="h-3.5 w-3.5" /> },
  { key: 'analytics', label: 'Аналітика', icon: <BarChart2 className="h-3.5 w-3.5" /> },
];

export function BallotsClient({ initialData }: BallotsClientProps) {
  const { ballots, election } = initialData;

  const [activeTab, setActiveTab] = useState<ActiveTab>('ballots');
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
  const [isMyBallotVisible, setIsMyBallotVisible] = useState(false);

  const isClosed = election.status === 'closed';
  const privateKey = election.privateKey;
  const canDecrypt = isClosed && !!privateKey && election.ballotCount > 0;
  const choices: ElectionChoice[] = election.choices;
  const electionId = election.id;

  useEffect(() => {
    const record = getVote(electionId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
            const [decryptedIds, hashValid] = await Promise.all([
              decryptBallotData(key, ballot.encryptedBallot),
              verifyBallotHash(ballot, electionId),
            ]);
            let choiceIds: string[] | null = null;
            let choiceLabels: string[] | null = null;
            let valid = false;
            if (decryptedIds !== null) {
              const validIds = decryptedIds.filter((id) => choices.some((c) => c.id === id));
              if (validIds.length === decryptedIds.length && validIds.length > 0) {
                choiceIds = validIds;
                choiceLabels = validIds.map((id) => choices.find((c) => c.id === id)?.choice ?? id);
                valid = true;
              }
            }
            map.set(ballot.id, { choiceIds, choiceLabels, valid, hashValid });
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

    return ballots.filter((b) => {
      const isHashMatch = b.currentHash.includes(q);
      const decryption = decryptedMap.get(b.id);
      const isLabelMatch =
        decryptionDone &&
        decryption?.choiceLabels?.some((label) => label.toLowerCase().includes(q));

      return isHashMatch || isLabelMatch;
    });
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.floor(idx / PAGE_SIZE) + 1);
    }
  }, [myVoteRecord, filteredBallots]);

  useEffect(() => {
    const el = myBallotRef.current;
    if (!el) {
      setIsMyBallotVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMyBallotVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [safePage, pagedBallots]);

  const handleScrollToMyBallot = () => {
    if (!myVoteRecord) return;
    const idx = filteredBallots.findIndex((b) => b.currentHash === myVoteRecord.ballotHash);
    if (idx !== -1) {
      const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
      if (safePage !== targetPage) {
        setPage(targetPage);
        setTimeout(() => {
          myBallotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      } else {
        myBallotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

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

  const myVoteMatchesDecryption = useMemo(() => {
    if (!myDecryption || !myVoteRecord || !myDecryption.valid) return null;
    const decryptedIds = myDecryption.choiceIds || [];
    const storedIds = Array.isArray(myVoteRecord.choiceIds)
      ? myVoteRecord.choiceIds
      : [myVoteRecord.choiceIds];
    if (decryptedIds.length !== storedIds.length) return false;
    return storedIds.every((id) => decryptedIds.includes(id));
  }, [myDecryption, myVoteRecord]);

  return (
    <div className="space-y-5">
      {myVoteRecord && (
        <MyVoteBanner
          record={myVoteRecord}
          found={myBallot !== null}
          decryptionDone={decryptionDone}
          matchesDecryption={myVoteMatchesDecryption}
          decryptedChoiceLabels={myDecryption?.choiceLabels ?? null}
          showScrollButton={!isMyBallotVisible && activeTab === 'ballots'}
          onScrollTo={handleScrollToMyBallot}
        />
      )}

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabBadge={(key) => {
          if (key === 'analytics' && decryptionDone) {
            return 'Повна';
          }
          return null;
        }}
      />

      {activeTab === 'analytics' && (
        <AnalyticsPanel
          ballots={ballots}
          decryptedMap={decryptedMap}
          decryptionDone={decryptionDone}
          isDecrypting={isDecrypting}
          onDecrypt={handleDecryptAll}
          choices={choices}
          election={election}
        />
      )}

      {activeTab === 'ballots' && (
        <>
          {canDecrypt && (
            <DecryptionPanel
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

            {ballots.length > 0 && (
              <SearchInput
                value={searchQuery}
                onChange={handleSearch}
                className="max-w-md"
                placeholder={
                  decryptionDone
                    ? 'Пошук за хешем або варіантом відповіді…'
                    : 'Пошук за хешем бюлетеня…'
                }
              />
            )}
          </div>

          {ballots.length === 0 ? (
            <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-12 text-center">
              <EmptyState
                title={isClosed ? 'Жодних бюлетенів не було подано' : 'Бюлетенів поки немає'}
                description={isClosed ? 'Ніхто не проголосував' : 'Ще ніхто не проголосував'}
                icon={<FileText className="text-kpi-gray-mid h-7 w-7" />}
              />
            </div>
          ) : pagedBallots.length === 0 ? (
            <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-12 text-center">
              <EmptyState
                title="Нічого не знайдено"
                description="Спробуйте змінити пошуковий запит"
                icon={<CircleSlash2 className="text-kpi-gray-mid h-7 w-7" />}
              />
            </div>
          ) : (
            <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
              {decryptionDone && invalidHashCount > 0 && (
                <div className="font-body border-error/20 bg-error-bg text-error flex items-center gap-2 border-b px-5 py-3 text-sm">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{invalidHashCount}</strong>{' '}
                    {pluralize(invalidHashCount, ['бюлетень', 'бюлетені', 'бюлетенів'], false)}{' '}
                    мають некоректний хеш
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
                        myStoredChoiceLabels={isMyBallot ? myVoteRecord!.choiceLabels : undefined}
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
        </>
      )}
    </div>
  );
}

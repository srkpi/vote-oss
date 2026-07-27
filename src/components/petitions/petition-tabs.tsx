'use client';

import { useCallback, useState } from 'react';

import { CommentSection } from '@/components/comments/comment-section';
import { AnalyticsPanel } from '@/components/elections/analytics/analytics-panel';
import { PetitionSignatories } from '@/components/petitions/petition-signatories';
import { Tabs } from '@/components/ui/tabs';
import { useBallotDecryption } from '@/hooks/use-ballot-decryption';
import type { Ballot, BallotsResponse } from '@/types/ballot';
import type { CommentsListResponse } from '@/types/comment';

type TabKey = 'comments' | 'supporters' | 'analytics';

interface PetitionTabsProps {
  electionId: string;
  ballotsData: BallotsResponse | null;
  ballotsError: string | null;
  commentsData: CommentsListResponse | null;
  commentsError: string | null;
  discussionClosed: boolean;
  commentCount: number;
  supporterCount: number;
}

// Stable fallbacks — inline `[]` / `{}` literals would create a fresh
// reference every render while ballotsData is null, which would defeat the
// decryption hook's "did the underlying data actually change" check.
const EMPTY_BALLOTS: Ballot[] = [];
const EMPTY_ELECTION: Pick<BallotsResponse['election'], 'privateKey' | 'choices'> = {
  privateKey: undefined,
  choices: [],
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'comments', label: 'Коментарі' },
  { key: 'supporters', label: 'Підписанти' },
  { key: 'analytics', label: 'Аналітика' },
];

export function PetitionTabs({
  electionId,
  ballotsData,
  ballotsError,
  commentsData,
  commentsError,
  discussionClosed,
  commentCount,
  supporterCount,
}: PetitionTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('comments');

  const election = ballotsData?.election ?? EMPTY_ELECTION;

  // Petitions' private key is always available once ballotsData loads, so
  // decryption here is only deferred to avoid decrypting hundreds of
  // signatures nobody looks at — triggered the first time the user opens
  // Supporters or Analytics, never on mount.
  const { decryptedMap, isDecrypting, decryptionDone, decrypt } = useBallotDecryption({
    ballots: ballotsData?.ballots ?? EMPTY_BALLOTS,
    privateKey: election.privateKey,
    choices: election.choices,
  });

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      if (tab === 'supporters' || tab === 'analytics') {
        decrypt();
      }
    },
    [decrypt],
  );

  const counts: Record<TabKey, number | null> = {
    comments: commentCount,
    supporters: supporterCount,
    analytics: null,
  };

  return (
    <div className="space-y-4">
      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabBadge={(key) => counts[key]}
      />

      {activeTab === 'comments' && (
        <CommentSection
          electionId={electionId}
          discussionClosed={discussionClosed}
          initialData={commentsData}
          fetchError={commentsError}
        />
      )}

      {activeTab === 'supporters' && (
        <PetitionSignatories
          electionId={electionId}
          initialData={ballotsData}
          fetchError={ballotsError}
          decryptedMap={decryptedMap}
          decryptionDone={decryptionDone}
        />
      )}

      {activeTab === 'analytics' &&
        (ballotsData ? (
          <AnalyticsPanel
            election={ballotsData.election}
            ballots={ballotsData.ballots}
            decryptedMap={decryptedMap}
            decryptionDone={decryptionDone}
            showKpiIndicators={false}
            isDecrypting={isDecrypting}
            onDecrypt={decrypt}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            {ballotsError ?? 'Аналітика поки недоступна.'}
          </p>
        ))}
    </div>
  );
}

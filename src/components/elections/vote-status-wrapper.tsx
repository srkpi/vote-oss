'use client';

import { useEffect, useState } from 'react';

import { AlreadyVotedCard } from '@/components/elections/already-voted-card';
import { VoteForm } from '@/components/elections/vote-form';
import { getVote } from '@/lib/vote-storage';
import type { ElectionDetail } from '@/types/election';
import type { VoteRecord } from '@/types/vote';

interface VoteStatusWrapperProps {
  election: ElectionDetail;
}

export function VoteStatusWrapper({ election }: VoteStatusWrapperProps) {
  // undefined = not yet checked (avoids SSR mismatch), null = not voted, record = voted
  const [record, setRecord] = useState<VoteRecord | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setRecord(getVote(election.id));
    })();
  }, [election.id]);

  // Avoid flash of wrong content during hydration
  if (record === undefined) {
    return (
      <div className="flex h-24 items-center justify-center">
        <div className="border-kpi-navy h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (record) {
    return <AlreadyVotedCard record={record} />;
  }

  return <VoteForm election={election} />;
}

'use client';

import { useState, useEffect } from 'react';
import { getVote } from '@/lib/vote-storage';
import { AlreadyVotedCard } from './already-voted-card';
import { VoteForm } from '@/components/elections/vote-form';
import type { ElectionDetail, VoteRecord } from '@/types';

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
      <div className="h-24 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--kpi-navy)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (record) {
    return <AlreadyVotedCard record={record} />;
  }

  return <VoteForm election={election} />;
}

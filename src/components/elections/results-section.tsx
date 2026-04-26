'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { pluralize } from '@/lib/utils/common';
import type { ElectionChoice } from '@/types/election';

import { ResultsChart } from './result-chart';
import { type ChoiceSortOrder, SortChoicesButton } from './sort-choices-button';

interface ResultsSectionProps {
  title: string;
  choices: ElectionChoice[];
  totalBallots: number;
  electionId: string;
  hideOwnVote?: boolean;
  variant?: 'client' | 'admin';
}

export function ResultsSection({
  title,
  choices,
  totalBallots,
  electionId,
  hideOwnVote,
  variant = 'client',
}: ResultsSectionProps) {
  const [sortOrder, setSortOrder] = useState<ChoiceSortOrder>('original');
  const showSort = choices.length > 1;

  if (variant === 'admin') {
    return (
      <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
        <div className="border-border-subtle flex items-center gap-3 border-b px-4 py-4 sm:px-6">
          <h2 className="font-display text-foreground flex-1 text-base font-semibold sm:text-lg">
            {title}
          </h2>
          <Badge variant="secondary" size="md">
            {pluralize(totalBallots, ['бюлетень', 'бюлетені', 'бюлетенів'])}
          </Badge>
          {showSort && <SortChoicesButton value={sortOrder} onChange={setSortOrder} />}
        </div>
        <div className="p-4 sm:p-6">
          <ResultsChart
            choices={choices}
            totalBallots={totalBallots}
            electionId={electionId}
            hideOwnVote={hideOwnVote}
            sortOrder={sortOrder}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
        {showSort && <SortChoicesButton value={sortOrder} onChange={setSortOrder} />}
      </div>
      <ResultsChart
        choices={choices}
        totalBallots={totalBallots}
        electionId={electionId}
        hideOwnVote={hideOwnVote}
        sortOrder={sortOrder}
      />
    </div>
  );
}

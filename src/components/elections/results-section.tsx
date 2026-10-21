'use client';

import { useState } from 'react';

import { ResultsChart } from '@/components/elections/result-chart';
import type { ChoiceSortOrder } from '@/components/elections/sort-choices-button';
import { SortChoicesButton } from '@/components/elections/sort-choices-button';
import { Badge } from '@/components/ui/badge';
import { pluralize } from '@/lib/utils/common';
import type { ElectionChoice } from '@/types/election';

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
      <div className="border-border-color overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-4 sm:px-6">
          <h2 className="flex-1 font-display text-base font-semibold text-foreground sm:text-lg">
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
    <div className="border-border-color rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
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

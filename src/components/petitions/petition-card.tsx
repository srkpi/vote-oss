import { Clock, User } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { LocalDate } from '@/components/ui/local-time';
import { PETITION_QUORUM } from '@/lib/constants';
import { cn } from '@/lib/utils/common';
import type { Election } from '@/types/election';

interface PetitionCardProps {
  petition: Election;
  index?: number;
}

export function PetitionCard({ petition, index = 0 }: PetitionCardProps) {
  const pct = Math.min(100, Math.round((petition.ballotCount / PETITION_QUORUM) * 100));
  const reached = petition.ballotCount >= PETITION_QUORUM;
  const isPending = !petition.approved;
  const isClosed = petition.status === 'closed';

  return (
    <Link
      href={`/petitions/${petition.id}`}
      className={cn(
        'group block rounded-xl bg-white',
        'border-border-color border',
        'shadow-shadow-card hover:shadow-shadow-card-hover',
        'transition-all duration-300 hover:-translate-y-1',
        'animate-fade-up overflow-hidden',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="min-w-0 space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {isPending && <Badge variant="warning">Очікує апруву</Badge>}
          {!isPending && isClosed && reached && <Badge variant="success">Досягнуто кворум</Badge>}
          {!isPending && isClosed && !reached && <Badge variant="secondary">Закрито</Badge>}
          {!isPending && !isClosed && <Badge variant="success">Активна</Badge>}
        </div>

        <h3 className="font-display text-foreground line-clamp-2 text-base leading-snug font-semibold wrap-break-word">
          {petition.title}
        </h3>

        {petition.description && (
          <p className="font-body text-muted-foreground line-clamp-3 text-sm wrap-break-word">
            {petition.description}
          </p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-body text-muted-foreground text-xs">
              Підписів: <strong className="text-foreground">{petition.ballotCount}</strong> /{' '}
              {PETITION_QUORUM}
            </span>
            <span className="font-body text-foreground text-xs font-semibold">{pct}%</span>
          </div>
          <div className="bg-surface h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                reached ? 'bg-kpi-green' : 'bg-kpi-navy',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="text-muted-foreground font-body flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{petition.createdBy.fullName}</span>
          </span>
          {petition.approved && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              до <LocalDate date={petition.closesAt} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

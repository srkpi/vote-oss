import { FileText, Play, StopCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import type { Election } from '@/types/election';

interface ElectionMobileCardProps {
  election: Election;
  canDelete: boolean;
  onDelete: () => void;
}

export function ElectionMobileCard({ election, canDelete, onDelete }: ElectionMobileCardProps) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/admin/elections/${election.id}`} className="min-w-0 flex-1">
          <div>
            <p className="font-body text-foreground text-sm leading-snug font-semibold wrap-break-word">
              {election.title}
            </p>
            <p className="font-body text-muted-foreground mt-0.5 text-xs">
              {election.creator.fullName}
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ElectionStatusBadge status={election.status} size="sm" />
          {canDelete && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onDelete}
              className="text-error hover:bg-error-bg"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Link href={`/admin/elections/${election.id}`}>
        <div className="font-body text-muted-foreground mt-2 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <Play className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDateTime(election.opensAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <StopCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDateTime(election.closesAt)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground font-semibold">{election.ballotCount}</span>
            Голосів
            {(election.restrictedToFaculty || election.restrictedToGroup) && (
              <Badge variant="info" size="sm" className="ml-2">
                {election.restrictedToGroup ?? election.restrictedToFaculty}
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

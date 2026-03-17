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
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/admin/elections/${election.id}`} className="flex-1 min-w-0">
          <div>
            <p className="text-sm font-semibold font-body text-[var(--foreground)] leading-snug break-words">
              {election.title}
            </p>
            <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5">
              {election.creator.full_name}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ElectionStatusBadge status={election.status} size="sm" />
          {canDelete && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onDelete}
              className="text-[var(--error)] hover:bg-[var(--error-bg)]"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <Link href={`/admin/elections/${election.id}`}>
        <div className="text-xs font-body text-[var(--muted-foreground)] space-y-1.5 mt-2">
          <div className="flex items-center gap-2">
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDateTime(election.opensAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <StopCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDateTime(election.closesAt)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold text-[var(--foreground)]">{election.ballotCount}</span>
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

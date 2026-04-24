import { FileText, Play, RotateCcw, StopCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import type { Election } from '@/types/election';

interface ElectionMobileCardProps {
  election: Election;
  canDelete: boolean;
  onDelete: () => void;
  onRestore: () => void;
}

export function ElectionMobileCard({
  election,
  canDelete,
  onDelete,
  onRestore,
}: ElectionMobileCardProps) {
  const isDeleted = !!election.deletedAt;
  const titleContent = (
    <>
      <p
        className={`font-body text-sm leading-snug font-semibold wrap-break-word ${
          isDeleted ? 'text-muted-foreground/60' : 'text-foreground'
        }`}
      >
        {election.title}
      </p>
      <p className="font-body text-muted-foreground/60 mt-0.5 text-xs">
        {election.createdBy.fullName}
      </p>
      {isDeleted && election.deletedBy && (
        <p className="font-body text-muted-foreground/50 mt-0.5 flex items-center gap-1 text-xs">
          <Trash2 className="h-3 w-3" />
          {election.deletedBy.fullName}
        </p>
      )}
    </>
  );

  const metaContent = (
    <div
      className={`font-body mt-2 space-y-1.5 text-xs ${isDeleted ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
    >
      <div className="flex items-center gap-2">
        <Play className="h-3.5 w-3.5 shrink-0" />
        <LocalDateTime date={election.opensAt} />
      </div>
      <div className="flex items-center gap-2">
        <StopCircle className="h-3.5 w-3.5 shrink-0" />
        <LocalDateTime date={election.closesAt} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span
          className={`font-semibold ${isDeleted ? 'text-muted-foreground/60' : 'text-foreground'}`}
        >
          {election.ballotCount}
        </span>
        {election.restrictions.length > 0 && (
          <Badge variant="info" size="sm" className="ml-2" muted={isDeleted}>
            Обмежено
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/admin/elections/${election.id}`} className="min-w-0 flex-1">
          {titleContent}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ElectionStatusBadge status={election.status} size="sm" muted={isDeleted} />
          {isDeleted && election.canRestore ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="text-kpi-navy hover:bg-kpi-blue-light/10 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : canDelete ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={onDelete}
              className="text-error hover:bg-error-bg"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {isDeleted ? (
        <div>{metaContent}</div>
      ) : (
        <Link href={`/admin/elections/${election.id}`}>{metaContent}</Link>
      )}
    </div>
  );
}

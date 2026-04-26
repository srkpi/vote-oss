import { RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Election } from '@/types/election';

interface ElectionRowProps {
  election: Election;
  canDelete: boolean;
  onDelete: () => void;
  onRestore: () => void;
}

export function ElectionRow({ election, canDelete, onDelete, onRestore }: ElectionRowProps) {
  const router = useRouter();
  const isDeleted = !!election.deletedAt;

  return (
    <tr className="group hover:bg-surface transition-colors duration-150">
      <td
        className="max-w-xs cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div>
          <p
            className={`font-body truncate text-sm font-medium transition-colors ${
              isDeleted ? 'text-muted-foreground/60' : 'text-foreground group-hover:text-kpi-navy'
            }`}
          >
            {election.title}
          </p>
          <p className="font-body text-muted-foreground/60 mt-0.5 truncate text-xs">
            {election.createdBy.fullName}
          </p>
          {isDeleted && election.deletedBy && (
            <p className="font-body text-muted-foreground/50 mt-0.5 flex items-center gap-1 truncate text-xs">
              <Trash2 className="h-3 w-3" />
              {election.deletedBy.fullName}
            </p>
          )}
        </div>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <StatusBadge status={election.status} size="md" muted={isDeleted} />
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p
          className={`font-body text-xs ${isDeleted ? 'text-muted-foreground/50' : 'text-foreground'}`}
        >
          <LocalDateTime date={election.opensAt} />
        </p>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p
          className={`font-body text-xs ${isDeleted ? 'text-muted-foreground/50' : 'text-foreground'}`}
        >
          <LocalDateTime date={election.closesAt} />
        </p>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`font-display text-xl font-bold ${isDeleted ? 'text-muted-foreground/50' : 'text-foreground'}`}
          >
            {election.ballotCount.toLocaleString('uk-UA')}
          </span>
          {election.status === 'open' && !isDeleted && (
            <span className="bg-success h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
          )}
        </div>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        {election.restrictions.length ? (
          <StatusBadge status="restricted" size="md" muted={isDeleted} />
        ) : (
          <Badge variant="success" size="md" muted={isDeleted}>
            Всі
          </Badge>
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        {isDeleted && election.canRestore ? (
          <Button
            variant="ghost"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            className="text-kpi-navy hover:bg-kpi-blue-light/10 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : canDelete ? (
          <Button
            variant="ghost"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-error hover:bg-error-bg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

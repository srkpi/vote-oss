import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import type { Election } from '@/types/election';

interface ElectionRowProps {
  election: Election;
  canDelete: boolean;
  onDelete: () => void;
}

export function ElectionRow({ election, canDelete, onDelete }: ElectionRowProps) {
  const router = useRouter();

  return (
    <tr className="group transition-colors duration-150 hover:bg-(--surface)">
      <td
        className="max-w-xs cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div>
          <p className="font-body truncate text-sm font-medium text-(--foreground) transition-colors group-hover:text-(--kpi-navy)">
            {election.title}
          </p>
          <p className="font-body mt-0.5 truncate text-xs text-(--muted-foreground)">
            {election.creator.full_name}
          </p>
        </div>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <ElectionStatusBadge status={election.status} size="md" />
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p className="font-body text-xs text-(--foreground)">{formatDateTime(election.opensAt)}</p>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p className="font-body text-xs text-(--foreground)">{formatDateTime(election.closesAt)}</p>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xl font-bold text-(--foreground)">
            {election.ballotCount.toLocaleString('uk-UA')}
          </span>
          {election.status === 'open' && (
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-(--success)" />
          )}
        </div>
      </td>
      <td
        className="cursor-pointer px-4 py-3.5"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div className="flex flex-col gap-1">
          {election.restrictedToFaculty || election.restrictedToGroup ? (
            <>
              {election.restrictedToFaculty && (
                <Badge variant="info" size="md">
                  {election.restrictedToFaculty}
                </Badge>
              )}
              {election.restrictedToGroup && (
                <Badge variant="secondary" size="md">
                  {election.restrictedToGroup}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="success" size="md">
              Всі
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        {canDelete && (
          <Button
            variant="ghost"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-(--error) transition-opacity hover:bg-(--error-bg)"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

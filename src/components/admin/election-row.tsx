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
    <tr className="hover:bg-[var(--surface)] transition-colors duration-150 group">
      <td
        className="px-4 py-3.5 max-w-xs cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div>
          <p className="text-sm font-medium font-body text-[var(--foreground)] truncate group-hover:text-[var(--kpi-navy)] transition-colors">
            {election.title}
          </p>
          <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5 truncate">
            {election.creator.full_name}
          </p>
        </div>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <ElectionStatusBadge status={election.status} size="md" />
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p className="text-xs font-body text-[var(--foreground)]">
          {formatDateTime(election.opensAt)}
        </p>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p className="text-xs font-body text-[var(--foreground)]">
          {formatDateTime(election.closesAt)}
        </p>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xl font-bold text-[var(--foreground)]">
            {election.ballotCount.toLocaleString('uk-UA')}
          </span>
          {election.status === 'open' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse shrink-0" />
          )}
        </div>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
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
            className="text-[var(--error)] hover:bg-[var(--error-bg)] transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

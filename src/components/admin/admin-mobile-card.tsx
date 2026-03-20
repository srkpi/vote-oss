import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import type { Admin } from '@/types/admin';

interface AdminMobileCardProps {
  admin: Admin;
  isCurrentUser: boolean;
  onDelete: () => void;
}

export function AdminMobileCard({ admin, isCurrentUser, onDelete }: AdminMobileCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-(--border-color) p-4',
        'bg-white shadow-(--shadow-sm)',
        isCurrentUser && 'border-(--kpi-navy)',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white">
            {admin.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-sm font-semibold text-(--foreground)">
                {admin.fullName}
              </p>
            </div>
            <p className="font-body mt-0.5 text-xs text-(--muted-foreground)">
              {admin.faculty} · {admin.group}
            </p>
          </div>
        </div>
        {!isCurrentUser && admin.deletable && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onDelete}
            className="text-(--error) hover:bg-(--error-bg)"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {admin.manageAdmins && (
          <Badge variant="info" size="sm">
            Керування адмінами
          </Badge>
        )}
        {admin.restrictedToFaculty && (
          <Badge variant="warning" size="sm">
            Обмежений до підрозділу
          </Badge>
        )}
        {!admin.manageAdmins && !admin.restrictedToFaculty && (
          <Badge variant="default" size="sm">
            Базові
          </Badge>
        )}
      </div>

      <p className="font-body mt-2 text-xs text-(--muted-foreground)">
        Призначено: {formatDate(admin.promotedAt)}
      </p>
      {admin.promoter && (
        <p className="font-body text-xs text-(--muted-foreground)">{admin.promoter.fullName}</p>
      )}
    </div>
  );
}

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
        'p-4 rounded-[var(--radius-lg)] border border-[var(--border-color)]',
        'bg-white shadow-[var(--shadow-sm)]',
        isCurrentUser && 'border-[var(--kpi-navy)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full navy-gradient flex items-center justify-center text-white font-semibold shrink-0">
            {admin.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[var(--foreground)] font-body">
                {admin.full_name}
              </p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5">
              {admin.faculty} · {admin.group}
            </p>
          </div>
        </div>
        {!isCurrentUser && admin.deletable && (
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

      <div className="mt-3 flex flex-wrap gap-1.5">
        {admin.manage_admins && (
          <Badge variant="info" size="sm">
            Керування адмінами
          </Badge>
        )}
        {admin.restricted_to_faculty && (
          <Badge variant="warning" size="sm">
            Обмежений до підрозділу
          </Badge>
        )}
        {!admin.manage_admins && !admin.restricted_to_faculty && (
          <Badge variant="default" size="sm">
            Базові
          </Badge>
        )}
      </div>

      <p className="text-xs text-[var(--muted-foreground)] font-body mt-2">
        Призначено: {formatDate(admin.promoted_at)}
      </p>
      {admin.promoter && (
        <p className="text-xs text-[var(--muted-foreground)] font-body">
          {admin.promoter.full_name}
        </p>
      )}
    </div>
  );
}

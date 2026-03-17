import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import type { Admin } from '@/types/admin';

interface AdminRowProps {
  admin: Admin;
  isCurrentUser: boolean;
  onDelete: () => void;
}

export function AdminRow({ admin, isCurrentUser, onDelete }: AdminRowProps) {
  return (
    <tr
      className={cn(
        'hover:bg-[var(--surface)] transition-colors duration-150',
        isCurrentUser && 'bg-[var(--kpi-blue-light)]/10',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full navy-gradient flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {admin.full_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)] font-body">
              {admin.full_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] font-body">{admin.user_id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm font-body text-[var(--foreground)]">{admin.faculty}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm font-body text-[var(--foreground)]">{admin.group}</span>
      </td>
      <td className="px-4 py-3.5">
        <div>
          <p className="text-sm font-body text-[var(--foreground)]">
            {formatDate(admin.promoted_at)}
          </p>
          {admin.promoter && (
            <p className="text-xs text-[var(--muted-foreground)] font-body">
              {admin.promoter.full_name}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
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
      </td>
      <td className="px-4 py-3.5">
        {!isCurrentUser && admin.deletable && (
          <Button
            variant="ghost"
            size="md"
            onClick={onDelete}
            className="text-[var(--error)] hover:bg-[var(--error-bg)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

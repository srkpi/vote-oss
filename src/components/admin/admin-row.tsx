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
        'transition-colors duration-150 hover:bg-(--surface)',
        isCurrentUser && 'bg-(--kpi-blue-light)/10',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
            {admin.fullName.charAt(0)}
          </div>
          <div>
            <p className="font-body text-sm font-medium text-(--foreground)">{admin.fullName}</p>
            <p className="font-body text-xs text-(--muted-foreground)">{admin.userId}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-sm text-(--foreground)">{admin.faculty}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-sm text-(--foreground)">{admin.group}</span>
      </td>
      <td className="px-4 py-3.5">
        <div>
          <p className="font-body text-sm text-(--foreground)">{formatDate(admin.promotedAt)}</p>
          {admin.promoter && (
            <p className="font-body text-xs text-(--muted-foreground)">{admin.promoter.fullName}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
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
      </td>
      <td className="px-4 py-3.5">
        {!isCurrentUser && admin.deletable && (
          <Button
            variant="ghost"
            size="md"
            onClick={onDelete}
            className="text-(--error) hover:bg-(--error-bg)"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

import { Calendar, ClipboardList, FileText, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';

import { MyRegistrationStatusBadge } from '@/components/registration/my-registration-status-badge';
import type {
  RegistrationFormStatus,
  RegistrationFormWithEligibility,
} from '@/components/registration/registration-card';
import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils/common';

interface RegistrationListItemProps {
  form: RegistrationFormWithEligibility;
  status: RegistrationFormStatus;
  index?: number;
}

export function RegistrationListItem({ form, status, index = 0 }: RegistrationListItemProps) {
  const isOpen = status === 'open';
  const isUpcoming = status === 'upcoming';
  const isClosed = status === 'closed';
  const actionable = form.eligible && isOpen;

  const stripeClass = cn(
    isOpen && form.eligible && 'bg-success',
    isOpen && !form.eligible && 'bg-rose-400',
    isUpcoming && 'bg-kpi-orange',
    isClosed && 'bg-kpi-gray-light',
  );

  return (
    <Link
      href={`/registration/${form.id}`}
      className={cn(
        'group flex items-stretch gap-4 px-4 py-4 sm:px-6',
        'border-border-subtle border-b last:border-b-0',
        'hover:bg-surface transition-colors duration-150',
        !actionable && 'opacity-70 hover:opacity-100',
        'animate-fade-up',
      )}
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
    >
      <div className={cn('w-1 shrink-0 self-stretch rounded-sm', stripeClass)} />

      <div className="min-w-0 flex-1 space-y-1.5 self-center">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} size="sm" />
          {!form.eligible && <StatusBadge status="unavailable" size="sm" />}
          {form.myRegistrationStatus && (
            <MyRegistrationStatusBadge status={form.myRegistrationStatus} size="sm" />
          )}
        </div>

        <p
          className={cn(
            'font-display text-foreground min-w-0 text-sm font-semibold wrap-break-word transition-colors duration-150 sm:text-base',
            'group-hover:text-kpi-navy',
          )}
        >
          {form.title}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-body text-muted-foreground flex items-center gap-1.5 text-xs">
            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{form.groupName}</span>
          </span>
          <span className="font-body text-muted-foreground flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {isOpen && (
              <>
                Прийом до <LocalDateTime date={form.closesAt} />
              </>
            )}
            {isUpcoming && (
              <>
                З <LocalDateTime date={form.opensAt} />
              </>
            )}
            {isClosed && <LocalDate date={form.closesAt} />}
          </span>
        </div>

        {(form.requiresCampaignProgram || form.teamSize > 0 || form.restrictions.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {form.requiresCampaignProgram && (
              <span className="font-body bg-surface text-muted-foreground border-border-subtle inline-flex items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs">
                <FileText className="h-2.5 w-2.5 shrink-0" />
                Програма
              </span>
            )}
            {form.teamSize > 0 && (
              <span className="font-body bg-surface text-muted-foreground border-border-subtle inline-flex items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs">
                <Users className="h-2.5 w-2.5 shrink-0" />
                Команда: {form.teamSize}
              </span>
            )}
            {form.restrictions.length > 0 && (
              <span className="font-body bg-surface text-muted-foreground border-border-subtle inline-flex items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs">
                <ShieldCheck className="h-2.5 w-2.5 shrink-0" />
                {form.restrictions.map((r) => r.value).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

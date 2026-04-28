import { Calendar, ClipboardList, FileText, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';

import { MyRegistrationStatusBadge } from '@/components/registration/my-registration-status-badge';
import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils/common';
import type { CandidateRegistrationFormSummary } from '@/types/candidate-registration';

export type RegistrationFormStatus = 'upcoming' | 'open' | 'closed';

export type RegistrationFormWithEligibility = CandidateRegistrationFormSummary;

interface RegistrationCardProps {
  form: RegistrationFormWithEligibility;
  status: RegistrationFormStatus;
  index?: number;
}

export function RegistrationCard({ form, status, index = 0 }: RegistrationCardProps) {
  const isOpen = status === 'open';
  const isUpcoming = status === 'upcoming';
  const isClosed = status === 'closed';
  const actionable = form.eligible && isOpen;

  return (
    <Link
      href={`/registration/${form.id}`}
      className={cn(
        'group block h-full overflow-hidden rounded-xl bg-white',
        'border-border-color border',
        'shadow-shadow-card',
        'hover:shadow-shadow-card-hover transition-all duration-300 hover:-translate-y-1',
        !actionable && 'opacity-90 hover:opacity-100',
        'animate-fade-up',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div
        className={cn(
          'h-1',
          isOpen && form.eligible && 'from-success bg-linear-to-r to-emerald-400',
          isOpen && !form.eligible && 'bg-linear-to-r from-rose-400 to-rose-300',
          isUpcoming && 'from-kpi-orange bg-linear-to-r to-amber-400',
          isClosed && 'from-kpi-gray-light bg-linear-to-r to-gray-300',
        )}
      />

      <div className="flex h-full flex-col p-6">
        <div className="mb-3 flex flex-wrap items-start gap-2">
          <StatusBadge status={status} />
          {!form.eligible && <StatusBadge status="unavailable" />}
          {form.myRegistrationStatus && (
            <MyRegistrationStatusBadge status={form.myRegistrationStatus} />
          )}
        </div>

        <h3
          className={cn(
            'font-display text-foreground mb-3 text-xl leading-snug font-semibold',
            'group-hover:text-kpi-navy',
            'line-clamp-2 wrap-break-word transition-colors duration-200',
          )}
        >
          {form.title}
        </h3>

        {form.description && (
          <p className="font-body text-muted-foreground mb-4 line-clamp-2 text-sm wrap-break-word">
            {form.description}
          </p>
        )}

        <div className="mb-5 space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <ClipboardList className="text-kpi-gray-mid h-4 w-4 shrink-0" />
            <span className="truncate">{form.groupName}</span>
          </div>

          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Calendar className="text-kpi-gray-mid h-4 w-4 shrink-0" />
            <span>
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
              {isClosed && (
                <>
                  Завершено <LocalDate date={form.closesAt} />
                </>
              )}
            </span>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5">
          {form.requiresCampaignProgram && (
            <span className="font-body bg-surface text-muted-foreground border-border-subtle inline-flex items-center gap-1 truncate rounded-full border px-2.5 py-1 text-xs">
              <FileText className="h-3 w-3 shrink-0" />
              Програма
            </span>
          )}
          {form.teamSize > 0 && (
            <span className="font-body bg-surface text-muted-foreground border-border-subtle inline-flex items-center gap-1 truncate rounded-full border px-2.5 py-1 text-xs">
              <Users className="h-3 w-3 shrink-0" />
              Команда: {form.teamSize}
            </span>
          )}
          {form.restrictions.length > 0 && (
            <span className="font-body bg-surface text-muted-foreground border-border-subtle inline-flex items-center gap-1 truncate rounded-full border px-2.5 py-1 text-xs">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              {form.restrictions.map((r) => r.value).join(', ')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function RegistrationCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="animate-fade-up border-border-color overflow-hidden rounded-xl border bg-white"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="skeleton h-1" />
      <div className="space-y-4 p-6">
        <div className="skeleton h-5 w-24 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-6 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

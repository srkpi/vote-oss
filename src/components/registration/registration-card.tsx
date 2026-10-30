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
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-xl bg-card',
        'border-border-color border',
        'shadow-card',
        'transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover',
        !actionable && 'opacity-90 hover:opacity-100',
        'animate-fade-up',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <Link
        href={`/registration/${form.id}`}
        className={cn(
          'absolute inset-0 z-0 rounded-xl',
          'focus-visible:ring-2 focus-visible:ring-kpi-blue-light focus-visible:outline-none focus-visible:ring-inset',
        )}
      />

      <div
        className={cn(
          'h-1',
          isOpen && form.eligible && 'bg-linear-to-r from-success to-emerald-400',
          isOpen && !form.eligible && 'bg-linear-to-r from-rose-400 to-rose-300',
          isUpcoming && 'bg-linear-to-r from-kpi-orange to-amber-400',
          isClosed && 'bg-linear-to-r from-kpi-gray-light to-gray-300',
        )}
      />

      <div className="flex h-full flex-col space-y-3 p-6">
        <div className="flex flex-wrap items-start gap-2">
          <StatusBadge status={status} />
          {!form.eligible && <StatusBadge status="unavailable" />}
          {form.myRegistrationStatus && (
            <MyRegistrationStatusBadge status={form.myRegistrationStatus} />
          )}
        </div>

        <h3
          className={cn(
            'font-display text-xl leading-snug font-semibold text-foreground',
            'group-hover:text-kpi-navy',
            'line-clamp-2 wrap-break-word transition-colors duration-200',
          )}
        >
          {form.title}
        </h3>

        {form.description && (
          <p className="font-body line-clamp-2 text-sm wrap-break-word text-muted-foreground">
            {form.description}
          </p>
        )}

        <div className="mt-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4 shrink-0 text-kpi-gray-mid" />
              <span className="truncate">{form.groupName}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0 text-kpi-gray-mid" />
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

          <div className="flex flex-wrap gap-1.5 pt-2">
            {form.requiresCampaignProgram && (
              <span className="font-body inline-flex items-center gap-1 truncate rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" />
                Програма
              </span>
            )}
            {form.teamSize > 0 && (
              <span className="font-body inline-flex items-center gap-1 truncate rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                Команда: {form.teamSize}
              </span>
            )}
            {form.restrictions.length > 0 && (
              <span className="font-body inline-flex items-center gap-1 truncate rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                {form.restrictions.map((r) => r.value).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegistrationCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="animate-fade-up border-border-color overflow-hidden rounded-xl border bg-card"
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

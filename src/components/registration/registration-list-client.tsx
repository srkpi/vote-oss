'use client';

import { ClipboardList, FileText, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils/common';
import type { CandidateRegistrationForm } from '@/types/candidate-registration';

type FormWithEligibility = CandidateRegistrationForm & { eligible: boolean };

interface RegistrationListClientProps {
  initialForms: FormWithEligibility[];
  error: string | null;
}

type FormStatus = 'upcoming' | 'open' | 'closed';

function statusOf(form: CandidateRegistrationForm): FormStatus {
  const now = Date.now();
  if (now < new Date(form.opensAt).getTime()) return 'upcoming';
  if (now > new Date(form.closesAt).getTime()) return 'closed';
  return 'open';
}

export function RegistrationListClient({ initialForms, error }: RegistrationListClientProps) {
  const forms = initialForms;

  return (
    <>
      <PageHeader
        title="Реєстрація кандидатів"
        description="Перелік форм, відкритих для подачі заявок"
        isContainer
      />
      <div className="container py-8">
        {error && (
          <Alert variant="error" title="Помилка завантаження" className="mb-6">
            {error}
          </Alert>
        )}

        {!error && forms.length === 0 ? (
          <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              title="Зараз немає відкритих форм"
              description="ВКСУ ще не публікувала форм реєстрації для виборних органів"
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {forms.map((form) => {
              const status = statusOf(form);
              const clickable = form.eligible && status === 'open';
              const card = (
                <div
                  className={cn(
                    'border-border-color shadow-shadow-card rounded-xl border bg-white p-5',
                    clickable && 'hover:shadow-shadow-card-hover transition',
                    !clickable && 'opacity-90',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-foreground text-base font-semibold">
                      {form.title}
                    </h3>
                    <StatusBadge status={status} />
                    {!form.eligible && <StatusBadge status="unavailable" />}
                  </div>
                  {form.description && (
                    <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">
                      {form.description}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-2 text-xs">
                    Орган: <span className="text-foreground font-medium">{form.groupName}</span>
                  </p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {form.requiresCampaignProgram && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Передвиборча програма
                      </span>
                    )}
                    {form.teamSize > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Команда: {form.teamSize}
                      </span>
                    )}
                    {form.restrictions.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {form.restrictions.map((r) => `${r.value}`).join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Прийом до: <LocalDateTime date={form.closesAt} />
                  </p>
                </div>
              );
              return (
                <li key={form.id}>
                  {clickable ? (
                    <Link href={`/registration/${form.id}`} className="block">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

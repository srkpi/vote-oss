import { ClipboardList, FileText, Inbox, ShieldCheck, Users, Vote } from 'lucide-react';
import Link from 'next/link';

import { CampaignStageEditor } from '@/components/campaigns/campaign-stage-editor';
import { PageHeader } from '@/components/common/page-header';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge, type StatusKind } from '@/components/ui/status-badge';
import { ELECTION_KIND_LABEL } from '@/lib/campaigns-display';
import { RESTRICTION_TYPE_LABELS } from '@/lib/constants';
import type {
  CampaignFinalElectionSummary,
  CampaignSignatureElectionSummary,
  ElectionCampaign,
} from '@/types/campaign';
import type { CandidateRegistrationFormAdminSummary } from '@/types/candidate-registration';
import type { GroupDetail } from '@/types/group';

interface CampaignDashboardProps {
  group: GroupDetail;
  campaign: ElectionCampaign;
  registrationForm: CandidateRegistrationFormAdminSummary | null;
  signatureElections: CampaignSignatureElectionSummary[];
  finalElection: CampaignFinalElectionSummary | null;
}

function formStatusKind(form: CandidateRegistrationFormAdminSummary): StatusKind {
  const now = Date.now();
  if (now < new Date(form.opensAt).getTime()) return 'upcoming';
  if (now > new Date(form.closesAt).getTime()) return 'closed';
  return 'open';
}

interface FinalElectionBodyProps {
  election: CampaignFinalElectionSummary;
  isCompleted: boolean;
}

function FinalElectionBody({ election, isCompleted }: FinalElectionBodyProps) {
  const choices = [...election.choices].sort((a, b) => {
    if (isCompleted) {
      const av = a.voteCount ?? -1;
      const bv = b.voteCount ?? -1;
      if (bv !== av) return bv - av;
    }
    return a.position - b.position;
  });
  const winningCount = isCompleted
    ? choices.reduce((max, c) => Math.max(max, c.voteCount ?? 0), 0)
    : null;

  return (
    <div>
      <div className="text-muted-foreground border-border-subtle flex flex-wrap gap-x-4 gap-y-1 border-b px-5 py-3 text-xs">
        <span>
          <LocalDateTime date={election.opensAt} /> — <LocalDateTime date={election.closesAt} />
        </span>
        <span>Бюлетенів: {election.ballotCount}</span>
      </div>
      <ul className="divide-border-subtle divide-y">
        {choices.map((c) => {
          const isWinner =
            isCompleted &&
            winningCount !== null &&
            winningCount > 0 &&
            (c.voteCount ?? 0) === winningCount;
          return (
            <li
              key={`${c.position}-${c.candidateRegistrationId ?? c.candidateFullName}`}
              className="flex items-start justify-between gap-3 px-5 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-body text-foreground text-sm">{c.candidateFullName}</span>
                {isWinner && <StatusBadge status="quorum" size="sm" label="Переможець" />}
              </div>
              <span className="text-muted-foreground text-xs">
                {c.voteCount === null ? '—' : `${c.voteCount} голосів`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="border-border-subtle border-t px-5 py-3">
        <Link
          href={`/elections/${election.electionId}`}
          className="text-kpi-navy text-sm underline hover:no-underline"
        >
          Відкрити голосування
        </Link>
      </div>
    </div>
  );
}

export function CampaignDashboard({
  group,
  campaign,
  registrationForm,
  signatureElections,
  finalElection,
}: CampaignDashboardProps) {
  const groupedRestrictions = campaign.restrictions.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r.value);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        nav={[
          { label: 'Групи', href: '/groups' },
          { label: group.name, href: `/groups/${group.id}` },
          { label: 'Виборча кампанія' },
        ]}
        title={campaign.positionTitle}
        description={ELECTION_KIND_LABEL[campaign.electionKind]}
        isContainer
      />

      <div className="container py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Timeline */}
            <CampaignStageEditor campaign={campaign} />

            {/* Registration form (Stage 2) */}
            <section className="border-border-color shadow-card rounded-xl border bg-white">
              <header className="border-border-subtle flex items-center gap-2 border-b px-5 py-4">
                <ClipboardList className="text-kpi-gray-mid h-4 w-4" />
                <h2 className="font-display text-foreground text-base font-semibold">
                  Реєстрація кандидатів
                </h2>
              </header>
              {registrationForm ? (
                <div className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-foreground text-sm font-semibold">
                      {registrationForm.title}
                    </p>
                    <StatusBadge status={formStatusKind(registrationForm)} size="sm" />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Прийом заявок: <LocalDateTime date={registrationForm.opensAt} /> —{' '}
                    <LocalDateTime date={registrationForm.closesAt} />
                  </p>
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Inbox className="h-3 w-3" />
                      Подано: {registrationForm.submittedCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      На розгляді: {registrationForm.pendingReviewCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Команда: {registrationForm.teamSize}
                    </span>
                    {registrationForm.requiresCampaignProgram && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Програма обов’язкова
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground pt-2 text-xs">
                    Заявки опрацьовуються на сторінці{' '}
                    <Link
                      href={`/groups/${group.id}`}
                      className="text-kpi-navy underline hover:no-underline"
                    >
                      вашої групи
                    </Link>
                    .
                  </p>
                </div>
              ) : campaign.state === 'ANNOUNCED' ? (
                <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                  Реєстраційну форму буде створено автоматично, коли кампанія перейде у стан
                  «Реєстрація».
                </p>
              ) : campaign.state === 'CANCELLED' ? (
                <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                  Кампанію скасовано — реєстраційну форму не створено.
                </p>
              ) : (
                <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                  Реєстраційну форму ще не створено. Cron підхопить її на наступному запуску.
                </p>
              )}
            </section>

            {/* Stage 3: signature collection */}
            {campaign.signatureCollection && (
              <section className="border-border-color shadow-card rounded-xl border bg-white">
                <header className="border-border-subtle flex items-center justify-between gap-2 border-b px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-kpi-gray-mid h-4 w-4" />
                    <h2 className="font-display text-foreground text-base font-semibold">
                      Збір підписів
                    </h2>
                  </div>
                  {campaign.signatureQuorum !== null && (
                    <span className="text-muted-foreground text-xs">
                      Кворум: {campaign.signatureQuorum}
                    </span>
                  )}
                </header>
                {signatureElections.length > 0 ? (
                  <ul className="divide-border-subtle divide-y">
                    {signatureElections.map((sig) => (
                      <li
                        key={sig.electionId}
                        className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/elections/${sig.electionId}`}
                              className="font-body text-foreground hover:text-kpi-navy text-sm font-semibold transition-colors"
                            >
                              {sig.candidateFullName}
                            </Link>
                            <StatusBadge status={sig.status} size="sm" />
                            {sig.quorumReached && (
                              <StatusBadge status="quorum" size="sm" label="Кворум зібрано" />
                            )}
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            <LocalDateTime date={sig.opensAt} /> —{' '}
                            <LocalDateTime date={sig.closesAt} />
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-body text-foreground text-sm font-semibold">
                            {sig.ballotCount}
                            <span className="text-muted-foreground text-xs"> / {sig.quorum}</span>
                          </p>
                          <p className="text-muted-foreground text-xs">підписів</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : campaign.state === 'ANNOUNCED' ||
                  campaign.state === 'REGISTRATION_OPEN' ||
                  campaign.state === 'REGISTRATION_REVIEW' ? (
                  <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                    Голосування за підписи створяться автоматично після завершення розгляду заявок.
                  </p>
                ) : campaign.state === 'CANCELLED' ? (
                  <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                    Кампанію скасовано — голосування за підписи не створено.
                  </p>
                ) : campaign.state === 'FAILED' ? (
                  <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                    Кампанія не відбулася — жоден кандидат не пройшов розгляд заявок.
                  </p>
                ) : (
                  <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                    Голосування за підписи ще не створено. Cron підхопить їх на наступному запуску.
                  </p>
                )}
              </section>
            )}

            {/* Stage 4: final election */}
            <section className="border-border-color shadow-card rounded-xl border bg-white">
              <header className="border-border-subtle flex items-center justify-between gap-2 border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <Vote className="text-kpi-gray-mid h-4 w-4" />
                  <h2 className="font-display text-foreground text-base font-semibold">
                    Фінальне голосування
                  </h2>
                </div>
                {finalElection && <StatusBadge status={finalElection.status} size="sm" />}
              </header>
              {finalElection ? (
                <FinalElectionBody
                  election={finalElection}
                  isCompleted={campaign.state === 'COMPLETED'}
                />
              ) : campaign.state === 'CANCELLED' ? (
                <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                  Кампанію скасовано — голосування не створено.
                </p>
              ) : campaign.state === 'FAILED' ? (
                <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                  Кампанія не відбулася — голосування не створено.
                </p>
              ) : (
                <p className="font-body text-muted-foreground px-5 py-6 text-sm">
                  Голосування з усіма пройшовшими кандидатами створиться автоматично перед його
                  початком.
                </p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <section className="border-border-color shadow-card overflow-hidden rounded-xl border bg-white">
              <header className="border-border-subtle border-b px-5 py-4">
                <h3 className="font-display text-foreground text-base font-semibold">Параметри</h3>
              </header>
              <dl className="divide-border-subtle divide-y">
                <div className="px-5 py-3">
                  <dt className="text-muted-foreground text-xs">Тип виборів</dt>
                  <dd className="text-foreground text-sm">
                    {ELECTION_KIND_LABEL[campaign.electionKind]}
                  </dd>
                </div>
                <div className="px-5 py-3">
                  <dt className="text-muted-foreground text-xs">Розмір команди</dt>
                  <dd className="text-foreground text-sm">
                    {campaign.teamSize === 0 ? 'Без команди' : campaign.teamSize}
                  </dd>
                </div>
                <div className="px-5 py-3">
                  <dt className="text-muted-foreground text-xs">Передвиборча програма</dt>
                  <dd className="text-foreground text-sm">
                    {campaign.requiresCampaignProgram ? 'Обов’язкова' : 'Необов’язкова'}
                  </dd>
                </div>
                <div className="px-5 py-3">
                  <dt className="text-muted-foreground text-xs">Створено</dt>
                  <dd className="text-foreground text-sm">
                    <LocalDateTime date={campaign.createdAt} />
                  </dd>
                </div>
              </dl>
            </section>

            {/* Restrictions */}
            <section className="border-border-color shadow-card overflow-hidden rounded-xl border bg-white">
              <header className="border-border-subtle border-b px-5 py-4">
                <h3 className="font-display text-foreground text-base font-semibold">Обмеження</h3>
              </header>
              {campaign.restrictions.length === 0 ? (
                <p className="font-body text-muted-foreground px-5 py-4 text-sm">
                  Без обмежень — у виборах беруть участь усі студенти.
                </p>
              ) : (
                <dl className="divide-border-subtle divide-y">
                  {Object.entries(groupedRestrictions).map(([type, values]) => (
                    <div key={type} className="px-5 py-3">
                      <dt className="text-muted-foreground text-xs">
                        {RESTRICTION_TYPE_LABELS[type] ?? type}
                      </dt>
                      <dd className="text-foreground text-sm">{values.join(', ')}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

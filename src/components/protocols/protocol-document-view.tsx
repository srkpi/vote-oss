'use client';

import { Download, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ProtocolWithCounts } from '@/lib/api/client';
import { PROTOCOL_PRESENT_TEXT_DEFAULT } from '@/lib/constants';
import { formatDate } from '@/lib/utils/common';
import type { GroupDetail } from '@/types/group';
import type { AgendaChoiceVote, ProtocolAttendee } from '@/types/protocol';

interface ProtocolDocumentViewProps {
  group: GroupDetail;
  protocol: ProtocolWithCounts;
  onBackToEdit?: () => void;
}

function isPresent(attendee: ProtocolAttendee): boolean {
  return attendee.present_text.toLowerCase().includes(PROTOCOL_PRESENT_TEXT_DEFAULT);
}

function attendeeOrderKey(attendee: ProtocolAttendee): number {
  return isPresent(attendee) ? 0 : 1;
}

export function ProtocolDocumentView({ group, protocol, onBackToEdit }: ProtocolDocumentViewProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedAttendees = useMemo(
    () =>
      [...protocol.attendance].sort((a, b) => {
        const ka = attendeeOrderKey(a);
        const kb = attendeeOrderKey(b);
        if (ka !== kb) return ka - kb;
        return a.fullname.localeCompare(b.fullname, 'uk');
      }),
    [protocol.attendance],
  );

  const showError = (message: string) => {
    setError(message);
    toast({ title: 'Помилка', description: message, variant: 'error' });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/protocols/${protocol.id}/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        let message = `Помилка генерації (${response.status})`;
        try {
          const body = await response.json();
          if (body && typeof body.message === 'string') message = body.message;
        } catch {
          /* ignore parse errors */
        }
        showError(message);
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(disposition);
      const filename = match
        ? decodeURIComponent(match[1] ?? match[2] ?? 'protocol.pdf')
        : 'protocol.pdf';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF згенеровано', variant: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Помилка мережі');
    } finally {
      setGenerating(false);
    }
  };

  const oss = protocol.ossSnapshot;
  const dateLabel = formatDate(protocol.date);
  const year = new Date(protocol.date).getFullYear();
  const presentCount = protocol.attendance.filter(isPresent).length;
  const logo = group.requisites.logo;

  return (
    <>
      <PageHeader
        nav={[
          { label: 'Групи', href: '/groups' },
          { label: group.name, href: `/groups/${group.id}` },
          { label: protocol.name || 'Протокол' },
        ]}
        title="Протокол"
        isContainer
      />

      <div className="container py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" asChild disabled={generating}>
              <Link href={`/groups/${group.id}`}>Назад до групи</Link>
            </Button>
            {onBackToEdit && (
              <Button
                variant="secondary"
                onClick={onBackToEdit}
                disabled={generating}
                icon={<Pencil className="h-3.5 w-3.5" />}
              >
                Редагувати
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleGenerate}
              loading={generating}
              icon={<Download className="h-3.5 w-3.5" />}
            >
              Згенерувати PDF
            </Button>
          </div>

          <article className="border-border-color shadow-shadow-card rounded-xl border bg-white px-6 py-10 sm:px-12 sm:py-14">
            {/* Letterhead */}
            <header className="border-border-subtle mb-10 flex flex-col items-center gap-3 border-b pb-6 text-center">
              {logo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logo.url}
                  alt={`Логотип ${oss.name}`}
                  className="mb-2 max-h-24 w-auto object-contain"
                />
              )}
              {oss.name && (
                <p className="font-display text-foreground text-base leading-tight font-semibold uppercase sm:text-lg">
                  {oss.name}
                </p>
              )}
              <div className="text-muted-foreground space-y-0.5 text-sm">
                {oss.address && <p>{oss.address}</p>}
                {(oss.email || oss.contact) && (
                  <p>
                    {oss.email}
                    {oss.email && oss.contact && ' · '}
                    {oss.contact}
                  </p>
                )}
              </div>
            </header>

            {/* Title */}
            <div className="mb-10 text-center">
              <h1 className="font-display text-foreground text-2xl font-bold tracking-wide uppercase sm:text-3xl">
                Протокол № {protocol.number}/{year}
              </h1>
              {protocol.name && (
                <p className="font-display text-foreground mt-3 text-lg sm:text-xl">
                  {protocol.name}
                </p>
              )}
              <p className="text-muted-foreground mt-3 text-sm">від {dateLabel}</p>
            </div>

            {/* Attendance summary */}
            <section className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <SummaryRow label="Усього членів" value={protocol.counts.total} />
              <SummaryRow label="Кворум (2/3)" value={protocol.counts.quorum} />
              <SummaryRow label="Присутні" value={presentCount || protocol.counts.present} />
              {protocol.visitors !== null && protocol.visitors > 0 && (
                <SummaryRow label="Запрошено гостей" value={protocol.visitors} />
              )}
            </section>

            {/* Agenda overview */}
            {protocol.agendaItems.length > 0 && (
              <section className="mb-10">
                <SectionHeading>Порядок денний</SectionHeading>
                <ol className="text-foreground space-y-1 text-sm leading-relaxed">
                  {protocol.agendaItems.map((item, idx) => (
                    <li key={`overview-${item.id}`} className="flex gap-2">
                      <span className="text-muted-foreground w-6 shrink-0 text-right">
                        {idx + 1}.
                      </span>
                      <span className="flex-1">{item.name}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Agenda details */}
            {protocol.agendaItems.length > 0 && (
              <section className="mb-10 space-y-8">
                {protocol.agendaItems.map((item, idx) => {
                  const totals = protocol.agendaVoteTotals[item.id] ?? null;
                  return (
                    <article key={item.id} className="space-y-3">
                      <h3 className="font-display text-foreground text-base font-semibold uppercase">
                        {idx + 1}. {item.name}
                      </h3>
                      {item.listeners.length > 0 && (
                        <div className="space-y-2 pl-4 text-sm">
                          <p className="font-display text-foreground text-sm font-semibold tracking-wider uppercase">
                            Слухали:
                          </p>
                          {item.listeners.map((l, lIdx) => (
                            <p key={lIdx} className="text-justify leading-relaxed">
                              <span className="font-medium">{l.fullname}</span>
                              {l.fullname && ': '}
                              <span className="text-foreground">{l.speech}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {item.result && (
                        <div className="pl-4 text-sm">
                          <p className="font-display text-foreground text-sm font-semibold tracking-wider uppercase">
                            Вирішили:
                          </p>
                          <p className="text-justify leading-relaxed">{item.result}</p>
                        </div>
                      )}
                      {totals && (
                        <div className="pl-4 text-sm">
                          <p className="font-display text-foreground text-sm font-semibold tracking-wider uppercase">
                            Голосували:
                          </p>
                          <p className="leading-relaxed">
                            <VoteTally label="За" value={totals.yes_count} vote="yes" />
                            <VoteTally label="Проти" value={totals.no_count} vote="no" />
                            <VoteTally
                              label="Утримались"
                              value={totals.not_decided_count}
                              vote="abstain"
                            />
                          </p>
                        </div>
                      )}
                      {item.electionId && !totals && (
                        <p className="text-muted-foreground pl-4 text-xs italic">
                          Деталі голосування недоступні для перегляду.
                        </p>
                      )}
                    </article>
                  );
                })}
              </section>
            )}

            {/* Signatures */}
            {protocol.responsibles.length > 0 && (
              <footer className="border-border-subtle mt-12 space-y-5 border-t pt-8">
                {protocol.responsibles.map((r, idx) => (
                  <div
                    key={`resp-${idx}`}
                    className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 text-sm"
                  >
                    <span className="text-foreground">{r.posada}</span>
                    <span className="border-border-color text-muted-foreground w-40 border-b pb-0.5 text-center text-xs">
                      підпис
                    </span>
                    <span className="text-foreground text-right font-medium">{r.fullname}</span>
                  </div>
                ))}
              </footer>
            )}

            {/* Attendance list */}
            {sortedAttendees.length > 0 && (
              <section className="mb-10 pt-8">
                <SectionHeading>Лист присутності</SectionHeading>
                <ol className="text-foreground space-y-1.5 text-sm leading-relaxed">
                  {sortedAttendees.map((a, idx) => (
                    <li key={`${a.userId ?? 'manual'}-${idx}`} className="flex gap-2">
                      <span className="text-muted-foreground w-6 shrink-0 text-right">
                        {idx + 1}.
                      </span>
                      <span className="flex-1">
                        <span className="font-medium">{a.fullname}</span>
                        {a.posada && <span className="text-muted-foreground"> — {a.posada}</span>}
                        <span
                          className={
                            isPresent(a) ? 'text-success ml-2' : 'text-muted-foreground ml-2'
                          }
                        >
                          — {a.present_text}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>
        </div>
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
      <span className="text-muted-foreground text-xs tracking-wider uppercase">{label}</span>
      <span className="font-display text-foreground text-lg font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-foreground border-border-subtle mb-3 border-b pb-1.5 text-sm font-semibold tracking-wider uppercase">
      {children}
    </h2>
  );
}

function VoteTally({
  label,
  value,
  vote,
}: {
  label: string;
  value: number;
  vote: AgendaChoiceVote;
}) {
  const color =
    vote === 'yes' ? 'text-success' : vote === 'no' ? 'text-error' : 'text-muted-foreground';
  return (
    <span className="mr-4 inline-block">
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className={`${color} font-semibold tabular-nums`}>{value}</span>
    </span>
  );
}

'use client';

import { CalendarClock, FileText, Megaphone, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/form';
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { StyledSelect } from '@/components/ui/styled-select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { CAMPAIGN_STATE_BADGE, ELECTION_KIND_LABEL } from '@/lib/campaigns-display';
import {
  CAMPAIGN_POSITION_TITLE_MAX_LENGTH,
  CAMPAIGN_REGISTRATION_DAYS_MAX,
  CAMPAIGN_REGISTRATION_DAYS_MIN,
  CAMPAIGN_REGISTRATION_REVIEW_DAYS_MAX,
  CAMPAIGN_REGISTRATION_REVIEW_DAYS_MIN,
  CAMPAIGN_SIGNATURE_DAYS_MAX,
  CAMPAIGN_SIGNATURE_DAYS_MIN,
  CAMPAIGN_SIGNATURE_QUORUM_MAX,
  CAMPAIGN_SIGNATURE_QUORUM_MIN,
  CAMPAIGN_SIGNATURE_REVIEW_DAYS_MAX,
  CAMPAIGN_SIGNATURE_REVIEW_DAYS_MIN,
  CAMPAIGN_TEAM_SIZE_MAX,
  CAMPAIGN_TEAM_SIZE_MIN,
} from '@/lib/constants';
import type { ElectionCampaign, ElectionCampaignRestriction, ElectionKind } from '@/types/campaign';

interface CampaignsPanelProps {
  groupId: string;
  initialCampaigns: ElectionCampaign[];
  initialLoadError: string | null;
}

export function CampaignsPanel({
  groupId,
  initialCampaigns,
  initialLoadError,
}: CampaignsPanelProps) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<ElectionCampaign[]>(initialCampaigns);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ElectionCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await api.campaigns.delete(deleteTarget.id);
    if (result.success) {
      toast({ title: 'Кампанію скасовано', variant: 'success' });
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  return (
    <div className="border-border-color shadow-shadow-card rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Megaphone className="text-kpi-gray-mid h-4 w-4" />
          <h2 className="font-display text-foreground text-base font-semibold">Вибори</h2>
        </div>
        <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span className="font-body text-sm">Нова</span>
        </Button>
      </div>

      {initialLoadError ? (
        <div className="p-4">
          <Alert variant="error">{initialLoadError}</Alert>
        </div>
      ) : campaigns.length === 0 ? (
        <p className="font-body text-muted-foreground px-5 py-8 text-center text-sm">
          У цій групі ще немає виборчих кампаній
        </p>
      ) : (
        <ul className="divide-border-subtle divide-y">
          {campaigns.map((c) => {
            const badge = CAMPAIGN_STATE_BADGE[c.state];
            return (
              <li key={c.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/groups/${groupId}/campaigns/${c.id}`}
                        className="font-body text-foreground hover:text-kpi-navy text-sm font-semibold transition-colors"
                      >
                        {c.positionTitle}
                      </Link>
                      <StatusBadge status={badge.kind} size="sm" label={badge.label} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {ELECTION_KIND_LABEL[c.electionKind]}
                    </p>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Голосування: <LocalDateTime date={c.votingOpensAt} /> —{' '}
                        <LocalDateTime date={c.votingClosesAt} />
                      </span>
                      {c.signatureCollection && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Кворум підписів: {c.signatureQuorum}
                        </span>
                      )}
                      {c.teamSize > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Команда: {c.teamSize}
                        </span>
                      )}
                      {c.requiresCampaignProgram && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Програма
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(c)}
                      className="text-error hover:bg-error-bg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CampaignCreateDialog
        groupId={groupId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(c) => {
          setCampaigns((prev) => [c, ...prev]);
          setCreateOpen(false);
        }}
      />

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Скасувати кампанію?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Кампанію <strong>«{deleteTarget?.positionTitle}»</strong> буде скасовано. Цю дію не
              можна скасувати — створіть нову кампанію, якщо буде потрібно.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Назад
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Скасувати
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Create dialog
// ────────────────────────────────────────────────────────────────────────────

interface CampaignCreateDialogProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (c: ElectionCampaign) => void;
}

function defaultAnnouncedAt(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

// Half-hourly HH:MM options 00:00–23:30 — granular enough for committee
// schedules without overwhelming the dropdown.
const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  const value = `${h}:${m}`;
  return { value, label: value };
});

/**
 * Combine a Date (its calendar day in Kyiv) with a `HH:MM` Kyiv-wall-clock
 * time and return the matching UTC instant.  Used on submit so the user-picked
 * announce date + opens-time dropdown collapse into a single `announced_at`.
 */
function combineKyivDateAndTime(date: Date, hhmm: string): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  // Re-use KyivDateTimePicker's logic by constructing the wall-clock string and
  // letting the browser parse it with the picker's input format.  Simpler: use
  // a tiny round-trip — parse YYYY-MM-DDTHH:MM as Kyiv local time.
  const utcGuess = new Date(`${parts.year}-${parts.month}-${parts.day}T${hhmm}:00Z`);
  const kyivParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Kyiv',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcGuess);
  const kyivObj = kyivParts.reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const kyivAsUtc = Date.UTC(
    Number(kyivObj.year),
    Number(kyivObj.month) - 1,
    Number(kyivObj.day),
    Number(kyivObj.hour === '24' ? '00' : kyivObj.hour),
    Number(kyivObj.minute),
    Number(kyivObj.second),
  );
  const offsetMs = kyivAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

function CampaignCreateDialog({ groupId, open, onClose, onCreated }: CampaignCreateDialogProps) {
  const [positionTitle, setPositionTitle] = useState('');
  const [electionKind, setElectionKind] = useState<ElectionKind>('REGULAR');
  const [announcedAt, setAnnouncedAt] = useState<Date>(defaultAnnouncedAt());
  const [registrationDays, setRegistrationDays] = useState(7);
  const [registrationReviewDays, setRegistrationReviewDays] = useState(2);
  const [signatureCollection, setSignatureCollection] = useState(false);
  const [signatureDays, setSignatureDays] = useState(7);
  const [signatureReviewDays, setSignatureReviewDays] = useState(2);
  const [signatureQuorum, setSignatureQuorum] = useState(100);
  const [registrationOpensTime, setRegistrationOpensTime] = useState('08:00');
  const [registrationClosesTime, setRegistrationClosesTime] = useState('20:00');
  const [signaturesOpensTime, setSignaturesOpensTime] = useState('08:00');
  const [signaturesClosesTime, setSignaturesClosesTime] = useState('20:00');
  const [teamSize, setTeamSize] = useState(0);
  const [requiresCampaignProgram, setRequiresCampaignProgram] = useState(false);
  const [votingOpensAt, setVotingOpensAt] = useState<Date | null>(null);
  const [votingClosesAt, setVotingClosesAt] = useState<Date | null>(null);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<string[]>([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const announced = defaultAnnouncedAt();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPositionTitle('');
    setElectionKind('REGULAR');
    setAnnouncedAt(announced);
    setRegistrationDays(7);
    setRegistrationReviewDays(2);
    setSignatureCollection(false);
    setSignatureDays(7);
    setSignatureReviewDays(2);
    setSignatureQuorum(100);
    setRegistrationOpensTime('08:00');
    setRegistrationClosesTime('20:00');
    setSignaturesOpensTime('08:00');
    setSignaturesClosesTime('20:00');
    setTeamSize(0);
    setRequiresCampaignProgram(false);
    setVotingOpensAt(null);
    setVotingClosesAt(null);
    setFaculties([]);
    setError(null);
  }, [open]);

  // Auto-suggest votingOpensAt/closesAt based on the chain of stages so the
  // form is valid by default.  User can still override.
  useEffect(() => {
    if (!open) return;
    const offsetDays =
      registrationDays +
      registrationReviewDays +
      (signatureCollection ? signatureDays + signatureReviewDays : 0);
    const opens = new Date(announcedAt.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    const closes = new Date(opens.getTime() + 3 * 24 * 60 * 60 * 1000);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVotingOpensAt(opens);
    setVotingClosesAt(closes);
  }, [
    open,
    announcedAt,
    registrationDays,
    registrationReviewDays,
    signatureCollection,
    signatureDays,
    signatureReviewDays,
  ]);

  // Load faculty list once.
  useEffect(() => {
    if (!open) return;
    if (facultyOptions.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFacultiesLoading(false);
      return;
    }
    api.campus.getGroups().then((res) => {
      if (res.success) {
        const list = Object.keys(res.data).sort((a, b) => {
          const aNN = a.startsWith('НН ');
          const bNN = b.startsWith('НН ');
          if (aNN !== bNN) return aNN ? 1 : -1;
          return a.localeCompare(b, 'uk');
        });
        setFacultyOptions(list);
      }
      setFacultiesLoading(false);
    });
  }, [open, facultyOptions.length]);

  const toggleFaculty = (faculty: string) => {
    setFaculties((prev) =>
      prev.includes(faculty) ? prev.filter((f) => f !== faculty) : [...prev, faculty],
    );
  };

  const handleSubmit = async () => {
    if (!votingOpensAt || !votingClosesAt) return;
    setSubmitting(true);
    setError(null);
    const restrictions: ElectionCampaignRestriction[] = faculties.map((value) => ({
      type: 'FACULTY',
      value,
    }));
    // announced_at = the user-picked date combined with the opens-time dropdown.
    // The picker's own time-of-day is overridden so the two inputs stay in sync.
    const composedAnnouncedAt = combineKyivDateAndTime(announcedAt, registrationOpensTime);
    const payload = {
      positionTitle: positionTitle.trim(),
      electionKind,
      announcedAt: composedAnnouncedAt.toISOString(),
      registrationDays,
      registrationReviewDays,
      registrationOpensTime,
      registrationClosesTime,
      signatureCollection,
      signatureDays: signatureCollection ? signatureDays : null,
      signatureReviewDays: signatureCollection ? signatureReviewDays : null,
      signatureQuorum: signatureCollection ? signatureQuorum : null,
      signaturesOpensTime: signatureCollection ? signaturesOpensTime : null,
      signaturesClosesTime: signatureCollection ? signaturesClosesTime : null,
      teamSize,
      requiresCampaignProgram,
      votingOpensAt: votingOpensAt.toISOString(),
      votingClosesAt: votingClosesAt.toISOString(),
      restrictions,
    };
    const result = await api.groups.campaigns.create(groupId, payload);
    if (result.success) {
      onCreated(result.data);
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  };

  const canSubmit =
    positionTitle.trim().length > 0 && !!votingOpensAt && !!votingClosesAt && !submitting;

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()}>
      <DialogPanel maxWidth="lg">
        <DialogHeader>
          <DialogTitle>Нова виборча кампанія</DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <FormField label="Тип посади" required htmlFor="position-title">
            <Input
              id="position-title"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              maxLength={CAMPAIGN_POSITION_TITLE_MAX_LENGTH}
              placeholder="Наприклад: Голова студради ФІОТ"
            />
          </FormField>

          <FormField label="Тип виборів" required>
            <select
              className="border-border-color w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={electionKind}
              onChange={(e) => setElectionKind(e.target.value as ElectionKind)}
            >
              {(Object.keys(ELECTION_KIND_LABEL) as ElectionKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {ELECTION_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Дата оголошення" required htmlFor="announced-at">
            <KyivDateTimePicker
              id="announced-at"
              value={announcedAt}
              onChange={(d) => setAnnouncedAt(d)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Дні реєстрації" required htmlFor="registration-days">
              <Input
                id="registration-days"
                type="number"
                min={CAMPAIGN_REGISTRATION_DAYS_MIN}
                max={CAMPAIGN_REGISTRATION_DAYS_MAX}
                value={registrationDays}
                onChange={(e) => setRegistrationDays(parseInt(e.target.value, 10) || 0)}
              />
            </FormField>
            <FormField label="Дні обробки заявок" required htmlFor="registration-review-days">
              <Input
                id="registration-review-days"
                type="number"
                min={CAMPAIGN_REGISTRATION_REVIEW_DAYS_MIN}
                max={CAMPAIGN_REGISTRATION_REVIEW_DAYS_MAX}
                value={registrationReviewDays}
                onChange={(e) => setRegistrationReviewDays(parseInt(e.target.value, 10) || 0)}
              />
            </FormField>
            <FormField label="Час початку реєстрації" required htmlFor="registration-opens-time">
              <StyledSelect
                id="registration-opens-time"
                options={TIME_OPTIONS}
                value={registrationOpensTime}
                onChange={setRegistrationOpensTime}
              />
            </FormField>
            <FormField label="Час кінця реєстрації" required htmlFor="registration-closes-time">
              <StyledSelect
                id="registration-closes-time"
                options={TIME_OPTIONS}
                value={registrationClosesTime}
                onChange={setRegistrationClosesTime}
              />
            </FormField>
          </div>

          <FormField label="Збір підписів">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={signatureCollection}
                onChange={(e) => setSignatureCollection(e.target.checked)}
              />
              <span>Кандидати мають зібрати підписи перед фінальним голосуванням</span>
            </label>
          </FormField>

          {signatureCollection && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="Час початку збору" required htmlFor="signatures-opens-time">
                <StyledSelect
                  id="signatures-opens-time"
                  options={TIME_OPTIONS}
                  value={signaturesOpensTime}
                  onChange={setSignaturesOpensTime}
                />
              </FormField>
              <FormField label="Час кінця збору" required htmlFor="signatures-closes-time">
                <StyledSelect
                  id="signatures-closes-time"
                  options={TIME_OPTIONS}
                  value={signaturesClosesTime}
                  onChange={setSignaturesClosesTime}
                />
              </FormField>
              <div className="hidden sm:block" />
              <FormField label="Дні збору" required htmlFor="signature-days">
                <Input
                  id="signature-days"
                  type="number"
                  min={CAMPAIGN_SIGNATURE_DAYS_MIN}
                  max={CAMPAIGN_SIGNATURE_DAYS_MAX}
                  value={signatureDays}
                  onChange={(e) => setSignatureDays(parseInt(e.target.value, 10) || 0)}
                />
              </FormField>
              <FormField label="Дні обробки" required htmlFor="signature-review-days">
                <Input
                  id="signature-review-days"
                  type="number"
                  min={CAMPAIGN_SIGNATURE_REVIEW_DAYS_MIN}
                  max={CAMPAIGN_SIGNATURE_REVIEW_DAYS_MAX}
                  value={signatureReviewDays}
                  onChange={(e) => setSignatureReviewDays(parseInt(e.target.value, 10) || 0)}
                />
              </FormField>
              <FormField label="Кворум" required htmlFor="signature-quorum">
                <Input
                  id="signature-quorum"
                  type="number"
                  min={CAMPAIGN_SIGNATURE_QUORUM_MIN}
                  max={CAMPAIGN_SIGNATURE_QUORUM_MAX}
                  value={signatureQuorum}
                  onChange={(e) => setSignatureQuorum(parseInt(e.target.value, 10) || 0)}
                />
              </FormField>
            </div>
          )}

          <FormField label="Вимоги до заявки">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requiresCampaignProgram}
                  onChange={(e) => setRequiresCampaignProgram(e.target.checked)}
                />
                <span>Кандидат має додати посилання на передвиборчу програму</span>
              </label>
              <div>
                <label className="text-foreground mb-1 flex items-center gap-2 text-sm">
                  <span>Розмір команди</span>
                  <Input
                    type="number"
                    min={CAMPAIGN_TEAM_SIZE_MIN}
                    max={CAMPAIGN_TEAM_SIZE_MAX}
                    value={teamSize}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isNaN(n)) {
                        setTeamSize(0);
                        return;
                      }
                      const clamped = Math.max(
                        CAMPAIGN_TEAM_SIZE_MIN,
                        Math.min(CAMPAIGN_TEAM_SIZE_MAX, n),
                      );
                      setTeamSize(clamped);
                    }}
                    className="w-20"
                  />
                </label>
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Початок голосування" required htmlFor="voting-opens-at">
              <KyivDateTimePicker
                id="voting-opens-at"
                value={votingOpensAt ?? defaultAnnouncedAt()}
                onChange={(d) => setVotingOpensAt(d)}
              />
            </FormField>
            <FormField label="Кінець голосування" required htmlFor="voting-closes-at">
              <KyivDateTimePicker
                id="voting-closes-at"
                value={votingClosesAt ?? defaultAnnouncedAt()}
                onChange={(d) => setVotingClosesAt(d)}
              />
            </FormField>
          </div>

          <FormField label="Підрозділи (необов’язково)">
            {facultiesLoading ? (
              <p className="text-muted-foreground text-xs">Завантажуємо список підрозділів…</p>
            ) : (
              <div className="border-border-color max-h-48 overflow-y-auto rounded-md border p-2">
                {facultyOptions.length === 0 ? (
                  <p className="text-muted-foreground p-2 text-xs">
                    Не вдалося завантажити підрозділи
                  </p>
                ) : (
                  facultyOptions.map((f) => (
                    <label
                      key={f}
                      className="hover:bg-surface flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={faculties.includes(f)}
                        onChange={() => toggleFaculty(f)}
                      />
                      <span>{f}</span>
                    </label>
                  ))
                )}
              </div>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              Якщо обрано хоча б один підрозділ — у виборах беруть участь лише його студенти.
            </p>
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Скасувати
          </Button>
          <Button
            variant="accent"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            Створити
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}

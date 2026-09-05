'use client';

import {
  Check,
  ClipboardList,
  FileText,
  Inbox,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { TeamSlotsPanel } from '@/components/registration/team-slots-panel';
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
import { FormField, Input, Textarea } from '@/components/ui/form';
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
import { LocalDateTime } from '@/components/ui/local-time';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextLink } from '@/components/ui/text-link';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH,
  REGISTRATION_FORM_MAX_TEAM_SIZE,
  REGISTRATION_FORM_TITLE_MAX_LENGTH,
  REGISTRATION_FORMS_ADMIN_PAGE_SIZE,
  REGISTRATION_REJECTION_REASON_MAX_LENGTH,
  REGISTRATION_SUBMISSIONS_PAGE_SIZE,
} from '@/lib/constants';
import { cn } from '@/lib/utils/common';
import type {
  CandidateRegistration,
  CandidateRegistrationForm,
  CandidateRegistrationFormAdminSummary,
  CandidateRegistrationFormRestriction,
  CandidateRegistrationStatus,
} from '@/types/candidate-registration';

interface RegistrationFormsPanelProps {
  groupId: string;
  initialForms: CandidateRegistrationFormAdminSummary[];
  initialLoadError: string | null;
}

type FormStatus = 'upcoming' | 'open' | 'closed';

function computeStatus(opensAt: string, closesAt: string): FormStatus {
  const now = Date.now();
  if (now < new Date(opensAt).getTime()) return 'upcoming';
  if (now > new Date(closesAt).getTime()) return 'closed';
  return 'open';
}

export function RegistrationFormsPanel({
  groupId,
  initialForms,
  initialLoadError,
}: RegistrationFormsPanelProps) {
  const { toast } = useToast();
  const [forms, setForms] = useState<CandidateRegistrationFormAdminSummary[]>(initialForms);
  const [page, setPage] = useState(1);

  const [formDialog, setFormDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; form: CandidateRegistrationFormAdminSummary } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<CandidateRegistrationFormAdminSummary | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [submissionsTarget, setSubmissionsTarget] =
    useState<CandidateRegistrationFormAdminSummary | null>(null);

  const totalPages = Math.max(1, Math.ceil(forms.length / REGISTRATION_FORMS_ADMIN_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedForms = forms.slice(
    (safePage - 1) * REGISTRATION_FORMS_ADMIN_PAGE_SIZE,
    safePage * REGISTRATION_FORMS_ADMIN_PAGE_SIZE,
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await api.registrationForms.delete(deleteTarget.id);
    if (result.success) {
      toast({ title: 'Форму видалено', variant: 'success' });
      setForms((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  const upsertForm = (form: CandidateRegistrationFormAdminSummary) => {
    setForms((prev) => {
      const idx = prev.findIndex((f) => f.id === form.id);
      if (idx === -1) return [form, ...prev];
      const next = [...prev];
      next[idx] = form;
      return next;
    });
  };

  return (
    <div className="border-border-color shadow-card rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="text-kpi-gray-mid h-4 w-4" />
          <h2 className="font-display text-foreground text-base font-semibold">
            Реєстрація кандидатів
          </h2>
        </div>
        <Button variant="accent" size="sm" onClick={() => setFormDialog({ mode: 'create' })}>
          <Plus className="h-3.5 w-3.5" />
          <span className="font-body text-sm">Нова</span>
        </Button>
      </div>

      {initialLoadError ? (
        <div className="p-4">
          <Alert variant="error">{initialLoadError}</Alert>
        </div>
      ) : forms.length === 0 ? (
        <p className="font-body text-muted-foreground px-5 py-8 text-center text-sm">
          У цій групі ще немає форм реєстрації кандидатів
        </p>
      ) : (
        <ul className="divide-border-subtle divide-y">
          {pagedForms.map((form) => {
            const status = computeStatus(form.opensAt, form.closesAt);
            return (
              <li key={form.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body text-foreground text-sm font-semibold">
                        {form.title}
                      </p>
                      <StatusBadge status={status} size="sm" />
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
                    <p className="text-muted-foreground mt-1 text-xs">
                      <LocalDateTime date={form.opensAt} /> — <LocalDateTime date={form.closesAt} />
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Заявок —{' '}
                      <span className="text-foreground font-semibold">{form.submittedCount}</span>{' '}
                      (з них на розгляді —{' '}
                      <span className="text-foreground font-semibold">
                        {form.pendingReviewCount}
                      </span>
                      )
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setSubmissionsTarget(form)}>
                      <Inbox className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Заявки</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormDialog({ mode: 'edit', form })}
                      title="Редагувати"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(form)}
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

      {totalPages > 1 && (
        <div className="border-border-subtle border-t px-5 py-3">
          <Pagination page={safePage} totalPages={totalPages} setPage={setPage} />
        </div>
      )}

      <RegistrationFormDialog
        groupId={groupId}
        open={!!formDialog}
        editTarget={formDialog?.mode === 'edit' ? formDialog.form : null}
        onClose={() => setFormDialog(null)}
        onSaved={(form) => {
          upsertForm(form);
          setFormDialog(null);
        }}
      />

      <SubmissionsDialog form={submissionsTarget} onClose={() => setSubmissionsTarget(null)} />

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити форму?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Форма <strong>«{deleteTarget?.title}»</strong> буде видалена. Це не вплине на вже
              подані заявки кандидатів.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Create / edit dialog
// ────────────────────────────────────────────────────────────────────────────

interface RegistrationFormDialogProps {
  groupId: string;
  open: boolean;
  editTarget?: CandidateRegistrationFormAdminSummary | null;
  onClose: () => void;
  onSaved: (form: CandidateRegistrationFormAdminSummary) => void;
}

function defaultStartDate(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function defaultEndDate(): Date {
  const d = defaultStartDate();
  d.setDate(d.getDate() + 7);
  return d;
}

function RegistrationFormDialog({
  groupId,
  open,
  editTarget = null,
  onClose,
  onSaved,
}: RegistrationFormDialogProps) {
  const isEdit = !!editTarget;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requiresCampaignProgram, setRequiresCampaignProgram] = useState(false);
  const [teamSize, setTeamSize] = useState(0);
  const [opensAt, setOpensAt] = useState<Date>(defaultStartDate());
  const [closesAt, setClosesAt] = useState<Date>(defaultEndDate());
  const [faculties, setFaculties] = useState<string[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<string[]>([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when editing a form whose registration window has already
  // opened: opensAt is then frozen at this value, and closesAt can only move
  // to a later time than this snapshot ("extend, don't shorten").
  const [startedAt, setStartedAt] = useState<{ opensAt: Date; closesAt: Date } | null>(null);

  // Re-renders every minute so date-pickers and validation stay in sync with "now".
  const [renderNowMs, setRenderNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setRenderNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [open]);
  const minFutureDate = new Date(renderNowMs + 60 * 1000);

  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      const originalOpensAt = new Date(editTarget.opensAt);
      const originalClosesAt = new Date(editTarget.closesAt);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(editTarget.title);
      setDescription(editTarget.description ?? '');
      setRequiresCampaignProgram(editTarget.requiresCampaignProgram);
      setTeamSize(editTarget.teamSize);
      setOpensAt(originalOpensAt);
      setClosesAt(originalClosesAt);
      setFaculties(editTarget.restrictions.filter((r) => r.type === 'FACULTY').map((r) => r.value));
      setStartedAt(
        Date.now() >= originalOpensAt.getTime()
          ? { opensAt: originalOpensAt, closesAt: originalClosesAt }
          : null,
      );
    } else {
      setTitle('');
      setDescription('');
      setRequiresCampaignProgram(false);
      setTeamSize(0);
      setOpensAt(defaultStartDate());
      setClosesAt(defaultEndDate());
      setFaculties([]);
      setStartedAt(null);
    }
    setError(null);
  }, [open, editTarget]);

  // Load faculty list once
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

  const handleSubmit = async () => {
    if (!startedAt) {
      // Not-yet-open form (or a brand-new one): both dates are free, but
      // still have to be in the future — this check was previously entirely
      // missing here, unlike the equivalent campaign dialog.
      const nowMs = Date.now();
      const futureChecks: Array<[Date, string]> = [
        [opensAt, 'Початок прийому'],
        [closesAt, 'Кінець прийому'],
      ];
      const pastField = futureChecks.find(([d]) => d.getTime() <= nowMs);
      if (pastField) {
        setError(`«${pastField[1]}» має бути після поточного часу`);
        return;
      }
    } else if (closesAt.getTime() < startedAt.closesAt.getTime()) {
      setError('Прийом заявок уже розпочато — «Кінець прийому» можна лише продовжити');
      return;
    }

    setSubmitting(true);
    setError(null);
    const restrictions: CandidateRegistrationFormRestriction[] = faculties.map((value) => ({
      type: 'FACULTY',
      value,
    }));
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      requiresCampaignProgram,
      teamSize,
      // opensAt is never touched by the picker once startedAt is set, but
      // send the frozen snapshot explicitly rather than the (equal) state
      // value, so a stray re-render can't ever submit a different opensAt.
      opensAt: (startedAt?.opensAt ?? opensAt).toISOString(),
      closesAt: closesAt.toISOString(),
      restrictions,
    };

    if (editTarget) {
      const result = await api.registrationForms.update(editTarget.id, payload);
      if (result.success) {
        // The update endpoint returns the base form only — editing dates,
        // title, etc. doesn't change submission counts, so carry them over.
        onSaved({
          ...result.data,
          submittedCount: editTarget.submittedCount,
          pendingReviewCount: editTarget.pendingReviewCount,
        });
      } else {
        setError(result.error);
      }
    } else {
      const result = await api.groups.registrationForms.create(groupId, payload);
      if (result.success) {
        onSaved(result.data);
      } else {
        setError(result.error);
      }
    }
    setSubmitting(false);
  };

  const toggleFaculty = (faculty: string) => {
    setFaculties((prev) =>
      prev.includes(faculty) ? prev.filter((f) => f !== faculty) : [...prev, faculty],
    );
  };

  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()}>
      <DialogPanel maxWidth="lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Редагувати форму реєстрації' : 'Нова форма реєстрації'}
          </DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <FormField label="Заголовок" required htmlFor="form-title">
            <Input
              id="form-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={REGISTRATION_FORM_TITLE_MAX_LENGTH}
              placeholder="Наприклад: Реєстрація на голову студради ФІОТ"
            />
          </FormField>

          <FormField label="Опис (необов’язково)" htmlFor="form-description">
            <Textarea
              id="form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH}
              placeholder="Деталі для кандидатів: як подати заявку, дедлайни, контакти ВКСУ"
            />
          </FormField>

          {startedAt && (
            <Alert variant="info">
              Прийом заявок вже розпочався: дату початку більше не можна змінити, а дату закінчення
              можна лише перенести на пізніше.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Початок прийому" required htmlFor="opens-at">
              {startedAt ? (
                <div className="border-border-color bg-surface text-muted-foreground flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <LocalDateTime date={opensAt.toISOString()} />
                </div>
              ) : (
                <KyivDateTimePicker
                  id="opens-at"
                  value={opensAt}
                  onChange={(d) => setOpensAt(d)}
                  min={minFutureDate}
                />
              )}
            </FormField>
            <FormField label="Кінець прийому" required htmlFor="closes-at">
              <KyivDateTimePicker
                id="closes-at"
                value={closesAt}
                onChange={(d) => setClosesAt(d)}
                min={
                  startedAt && startedAt.closesAt > minFutureDate
                    ? startedAt.closesAt
                    : minFutureDate
                }
              />
            </FormField>
          </div>

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
                    min={0}
                    max={REGISTRATION_FORM_MAX_TEAM_SIZE}
                    value={teamSize}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isNaN(n)) {
                        setTeamSize(0);
                        return;
                      }
                      const clamped = Math.max(0, Math.min(REGISTRATION_FORM_MAX_TEAM_SIZE, n));
                      setTeamSize(clamped);
                    }}
                    className="w-20"
                  />
                </label>
                <p className="text-muted-foreground text-xs">
                  Кількість людей, яких має запросити кандидат (0–
                  {REGISTRATION_FORM_MAX_TEAM_SIZE}). Кожен отримує окреме посилання-запрошення.
                </p>
              </div>
            </div>
          </FormField>

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
              Якщо обрано хоча б один підрозділ — заявку зможуть подавати лише його студенти.
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
            {isEdit ? 'Зберегти' : 'Створити'}
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Submissions dialog (reviewer-facing list with approve / reject)
// ────────────────────────────────────────────────────────────────────────────

const REG_STATUS_LABEL: Record<CandidateRegistrationStatus, string> = {
  DRAFT: 'Чернетка',
  AWAITING_TEAM: 'Очікує команду',
  PENDING_REVIEW: 'На розгляді',
  APPROVED: 'Затверджено',
  REJECTED: 'Відхилено',
  WITHDRAWN: 'Відкликано',
};

const REG_STATUS_BADGE: Record<CandidateRegistrationStatus, string> = {
  DRAFT: 'text-muted-foreground bg-surface',
  AWAITING_TEAM: 'text-kpi-orange bg-warning-bg',
  PENDING_REVIEW: 'text-kpi-navy bg-kpi-navy/10',
  APPROVED: 'text-success bg-success-bg',
  REJECTED: 'text-error bg-error-bg',
  WITHDRAWN: 'text-muted-foreground bg-gray-100',
};

interface SubmissionsDialogProps {
  form: CandidateRegistrationForm | null;
  onClose: () => void;
}

function SubmissionsDialog({ form, onClose }: SubmissionsDialogProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<CandidateRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CandidateRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!form) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      setLoadError(null);
      setPage(1);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPage(1);
    api.registrationForms.submissions(form.id).then((res) => {
      if (cancelled) return;
      if (res.success) setItems(res.data);
      else setLoadError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [form]);

  const totalPages = Math.max(1, Math.ceil(items.length / REGISTRATION_SUBMISSIONS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = items.slice(
    (safePage - 1) * REGISTRATION_SUBMISSIONS_PAGE_SIZE,
    safePage * REGISTRATION_SUBMISSIONS_PAGE_SIZE,
  );

  const replace = (next: CandidateRegistration) => {
    setItems((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  };

  const handleApprove = async (reg: CandidateRegistration) => {
    setBusy(reg.id);
    const result = await api.registrations.approve(reg.id);
    setBusy(null);
    if (result.success) {
      replace(result.data);
      toast({ title: 'Заявку затверджено', variant: 'success' });
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    const result = await api.registrations.reject(rejectTarget.id, rejectReason.trim());
    setRejecting(false);
    if (result.success) {
      replace(result.data);
      toast({ title: 'Заявку відхилено', variant: 'success' });
      setRejectTarget(null);
      setRejectReason('');
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
  };

  return (
    <>
      <Dialog open={!!form} onClose={() => !busy && onClose()}>
        <DialogPanel maxWidth="lg">
          <DialogHeader>
            <DialogTitle>{form ? `Заявки: ${form.title}` : 'Заявки'}</DialogTitle>
            <DialogCloseButton onClose={onClose} />
          </DialogHeader>
          <DialogBody className="space-y-3">
            {loading ? (
              <p className="text-muted-foreground text-sm">Завантажуємо…</p>
            ) : loadError ? (
              <Alert variant="error">{loadError}</Alert>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Поки що жодних поданих заявок
              </p>
            ) : (
              pagedItems.map((reg) => (
                <div key={reg.id} className="border-border-subtle space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-foreground text-sm font-semibold">
                      {reg.fullName}
                    </p>
                    {(reg.faculty || reg.group) && (
                      <span className="text-muted-foreground text-xs">
                        · {[reg.faculty, reg.group].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                        REG_STATUS_BADGE[reg.status],
                      )}
                    >
                      {REG_STATUS_LABEL[reg.status]}
                    </span>
                  </div>
                  <p className="text-muted-foreground font-mono text-xs">{reg.userId}</p>
                  <div className="text-foreground space-y-0.5 text-xs">
                    <p>Тел.: {reg.phoneNumber}</p>
                    {reg.telegramTag && <p>Telegram: {reg.telegramTag}</p>}
                    {reg.campaignProgramUrl && (
                      <p>
                        Програма: <TextLink href={reg.campaignProgramUrl}>посилання</TextLink>
                      </p>
                    )}
                  </div>
                  {reg.submittedAt && (
                    <p className="text-muted-foreground text-xs">
                      Подано: <LocalDateTime date={reg.submittedAt} />
                    </p>
                  )}
                  {reg.status === 'REJECTED' && reg.rejectionReason && (
                    <p className="text-error text-xs">Відхилено: {reg.rejectionReason}</p>
                  )}
                  {form && form.teamSize > 0 && (
                    <TeamSlotsPanel registrationId={reg.id} readOnly compact />
                  )}
                  {reg.status === 'PENDING_REVIEW' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(reg)}
                        loading={busy === reg.id}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Затвердити
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectTarget(reg);
                          setRejectReason('');
                        }}
                        className="text-error hover:bg-error-bg"
                      >
                        <X className="h-3.5 w-3.5" />
                        Відхилити
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
            {totalPages > 1 && (
              <div className="pt-2">
                <Pagination page={safePage} totalPages={totalPages} setPage={setPage} />
              </div>
            )}
          </DialogBody>
        </DialogPanel>
      </Dialog>

      <Dialog open={!!rejectTarget} onClose={() => !rejecting && setRejectTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Відхилити заявку?</DialogTitle>
            <DialogCloseButton onClose={() => setRejectTarget(null)} />
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-foreground text-sm">
              Заявка кандидата <strong>{rejectTarget?.fullName}</strong>. Причину буде показано
              кандидату.
            </p>
            <FormField label="Причина" required htmlFor="reject-reason">
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                maxLength={REGISTRATION_REJECTION_REASON_MAX_LENGTH}
                placeholder="Опишіть, чому заявку відхилено"
              />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectTarget(null)} disabled={rejecting}>
              Скасувати
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
              loading={rejecting}
              disabled={!rejectReason.trim()}
            >
              Відхилити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </>
  );
}

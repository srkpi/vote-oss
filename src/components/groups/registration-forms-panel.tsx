'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  ClipboardList,
  FileText,
  Inbox,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';

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
import {
  createRegistrationDialogSchema,
  getRegistrationDialogPhase,
  type RegistrationDialogValues,
} from '@/lib/schemas/registration-dialog-form';
import { cn, pluralize } from '@/lib/utils/common';
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
  if (now < new Date(opensAt).getTime()) {
    return 'upcoming';
  }
  if (now > new Date(closesAt).getTime()) {
    return 'closed';
  }
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
    if (!deleteTarget) {
      return;
    }
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
      if (idx === -1) {
        return [form, ...prev];
      }
      const next = [...prev];
      next[idx] = form;
      return next;
    });
  };

  return (
    <div className="border-border-color rounded-xl border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-kpi-gray-mid" />
          <h2 className="font-display text-base font-semibold text-foreground">
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
        <p className="font-body px-5 py-8 text-center text-sm text-muted-foreground">
          У цій групі ще немає форм реєстрації кандидатів
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {pagedForms.map((form) => {
            const status = computeStatus(form.opensAt, form.closesAt);
            return (
              <li key={form.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body text-sm font-semibold text-foreground">
                        {form.title}
                      </p>
                      <StatusBadge status={status} size="sm" />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      <LocalDateTime date={form.opensAt} /> — <LocalDateTime date={form.closesAt} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{form.submittedCount}</span>{' '}
                      {pluralize(form.submittedCount, ['заявка', 'заявки', 'заявок'], false)}
                      {form.pendingReviewCount > 0 && (
                        <>
                          , на розгляді —{' '}
                          <span className="font-semibold text-foreground">
                            {form.pendingReviewCount}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {form.submittedCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSubmissionsTarget(form)}>
                        <Inbox className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Заявки</span>
                      </Button>
                    )}
                    {status !== 'closed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormDialog({ mode: 'edit', form })}
                        title="Редагувати"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
        <div className="border-t border-border-subtle px-5 py-3">
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

function registrationDefaults(
  target: CandidateRegistrationFormAdminSummary | null,
): RegistrationDialogValues {
  return {
    title: target?.title ?? '',
    description: target?.description ?? '',
    requiresCampaignProgram: target?.requiresCampaignProgram ?? false,
    teamSize: target?.teamSize ?? 0,
    opensAt: target ? new Date(target.opensAt) : defaultStartDate(),
    closesAt: target ? new Date(target.closesAt) : defaultEndDate(),
    faculties: target?.restrictions.filter((r) => r.type === 'FACULTY').map((r) => r.value) ?? [],
  };
}

function RegistrationFormDialog({
  groupId,
  open,
  editTarget = null,
  onClose,
  onSaved,
}: RegistrationFormDialogProps) {
  const isEdit = !!editTarget;
  const {
    register,
    control,
    handleSubmit: submitForm,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting: submitting },
  } = useForm<RegistrationDialogValues>({
    resolver: zodResolver(createRegistrationDialogSchema(editTarget)),
    defaultValues: registrationDefaults(editTarget),
  });
  const { title } = useWatch({ control }) as RegistrationDialogValues;
  const error = errors.root?.message;
  const [facultyOptions, setFacultyOptions] = useState<string[]>([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);

  // Re-renders every minute so date-pickers, phase, and validation all stay
  // in sync with "now" while the dialog is left open.
  const [renderNowMs, setRenderNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) {
      return;
    }
    const id = setInterval(() => setRenderNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [open]);
  const minFutureDate = new Date(renderNowMs + 60 * 1000);

  // A brand-new form is always "not started". An existing one's phase is
  // derived live from its fixed opens/closes timestamps versus "now" rather
  // than snapshotted once, so the dialog re-locks itself in place if a
  // boundary passes while it's sitting open.
  const originalClosesAt = editTarget ? new Date(editTarget.closesAt) : null;
  const phase = getRegistrationDialogPhase(editTarget, renderNowMs);
  useEffect(() => {
    if (open) {
      reset(registrationDefaults(editTarget));
    }
  }, [open, editTarget, reset]);

  // Load faculty list once — skip entirely once restrictions are no longer editable.
  useEffect(() => {
    if (!open || phase !== 'not_started') {
      return;
    }
    if (facultyOptions.length > 0) {
      // oxlint-disable-next-line react/set-state-in-effect
      setFacultiesLoading(false);
      return;
    }
    api.campus.getGroups().then((res) => {
      if (res.success) {
        const list = Object.keys(res.data).sort((a, b) => {
          const aNN = a.startsWith('НН ');
          const bNN = b.startsWith('НН ');
          if (aNN !== bNN) {
            return aNN ? 1 : -1;
          }
          return a.localeCompare(b, 'uk');
        });
        setFacultyOptions(list);
      }
      setFacultiesLoading(false);
    });
  }, [open, phase, facultyOptions.length]);

  const handleSubmit = submitForm(async (values) => {
    clearErrors('root');
    const { title, description, requiresCampaignProgram, teamSize, opensAt, closesAt, faculties } =
      values;
    const restrictions: CandidateRegistrationFormRestriction[] = faculties.map((value) => ({
      type: 'FACULTY',
      value,
    }));
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      requiresCampaignProgram,
      teamSize,
      opensAt: opensAt.toISOString(),
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
        setError('root', { message: result.error });
      }
    } else {
      const result = await api.groups.registrationForms.create(groupId, payload);
      if (result.success) {
        onSaved(result.data);
      } else {
        setError('root', { message: result.error });
      }
    }
  });

  const canSubmit = phase !== 'closed' && title.trim().length > 0 && !submitting;

  // Once closed there is truly nothing left to edit — a dedicated, fields-free view.
  if (phase === 'closed') {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Форму закрито</DialogTitle>
            <DialogCloseButton onClose={onClose} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Прийом заявок за формою «{editTarget?.title}» вже завершився. Редагування більше
              недоступне.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Закрити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    );
  }

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
            <Alert variant="error" onDismiss={() => clearErrors('root')}>
              {error}
            </Alert>
          )}

          {phase === 'open' && (
            <Alert variant="info">
              Прийом заявок вже розпочався: усі інші поля заблоковано, можна лише перенести дату
              закінчення на пізніше.
            </Alert>
          )}

          {phase === 'not_started' && (
            <>
              <FormField
                label="Заголовок"
                required
                htmlFor="form-title"
                error={errors.title?.message}
              >
                <Input
                  id="form-title"
                  {...register('title')}
                  maxLength={REGISTRATION_FORM_TITLE_MAX_LENGTH}
                  placeholder="Наприклад: Реєстрація на голову студради ФІОТ"
                />
              </FormField>

              <FormField
                label="Опис (необов’язково)"
                htmlFor="form-description"
                error={errors.description?.message}
              >
                <Textarea
                  id="form-description"
                  {...register('description')}
                  rows={3}
                  maxLength={REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH}
                  placeholder="Деталі для кандидатів: як подати заявку, дедлайни, контакти ВКСУ"
                />
              </FormField>
            </>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {phase === 'not_started' && (
              <FormField
                label="Початок прийому"
                required
                htmlFor="opens-at"
                error={errors.opensAt?.message}
              >
                <Controller
                  control={control}
                  name="opensAt"
                  render={({ field }) => (
                    <KyivDateTimePicker
                      id="opens-at"
                      value={field.value}
                      onChange={field.onChange}
                      ref={field.ref}
                      min={minFutureDate}
                    />
                  )}
                />
              </FormField>
            )}
            <FormField
              label="Кінець прийому"
              required
              htmlFor="closes-at"
              error={errors.closesAt?.message}
            >
              <Controller
                control={control}
                name="closesAt"
                render={({ field }) => (
                  <KyivDateTimePicker
                    id="closes-at"
                    value={field.value}
                    onChange={field.onChange}
                    ref={field.ref}
                    min={
                      originalClosesAt && originalClosesAt > minFutureDate
                        ? originalClosesAt
                        : minFutureDate
                    }
                  />
                )}
              />
            </FormField>
          </div>

          {phase === 'not_started' && (
            <>
              <FormField label="Вимоги до заявки" error={errors.teamSize?.message}>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register('requiresCampaignProgram')} />
                    <span>Кандидат має додати посилання на передвиборчу програму</span>
                  </label>
                  <div>
                    <label className="mb-1 flex items-center gap-2 text-sm text-foreground">
                      <span>Розмір команди</span>
                      <Input
                        type="number"
                        min={0}
                        max={REGISTRATION_FORM_MAX_TEAM_SIZE}
                        {...register('teamSize', { valueAsNumber: true })}
                        className="w-20"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Кількість співбалотників, яких має запросити кандидат (0–
                      {REGISTRATION_FORM_MAX_TEAM_SIZE}). Кожен отримує окреме посилання-запрошення.
                    </p>
                  </div>
                </div>
              </FormField>

              <FormField label="Підрозділи (необов’язково)">
                {facultiesLoading ? (
                  <p className="text-xs text-muted-foreground">Завантажуємо список підрозділів…</p>
                ) : (
                  <div className="border-border-color max-h-48 overflow-y-auto rounded-md border p-2">
                    {facultyOptions.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">
                        Не вдалося завантажити підрозділи
                      </p>
                    ) : (
                      facultyOptions.map((f) => (
                        <label
                          key={f}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface"
                        >
                          <input type="checkbox" value={f} {...register('faculties')} />
                          <span>{f}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Якщо обрано хоча б один підрозділ — заявку зможуть подавати лише його студенти.
                </p>
              </FormField>
            </>
          )}
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
  WITHDRAWN: 'text-muted-foreground bg-muted',
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
      // oxlint-disable-next-line react/set-state-in-effect
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
      if (cancelled) {
        return;
      }
      if (res.success) {
        setItems(res.data);
      } else {
        setLoadError(res.error);
      }
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
    if (!rejectTarget) {
      return;
    }
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
              <p className="text-sm text-muted-foreground">Завантажуємо…</p>
            ) : loadError ? (
              <Alert variant="error">{loadError}</Alert>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Поки що жодних поданих заявок
              </p>
            ) : (
              pagedItems.map((reg) => (
                <div key={reg.id} className="space-y-2 rounded-lg border border-border-subtle p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body text-sm font-semibold text-foreground">
                      {reg.fullName}
                    </p>
                    {(reg.faculty || reg.group) && (
                      <span className="text-xs text-muted-foreground">
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
                  <p className="font-mono text-xs text-muted-foreground">{reg.userId}</p>
                  <div className="space-y-0.5 text-xs text-foreground">
                    <p>Тел.: {reg.phoneNumber}</p>
                    {reg.telegramTag && <p>Telegram: {reg.telegramTag}</p>}
                    {reg.campaignProgramUrl && (
                      <p>
                        Програма: <TextLink href={reg.campaignProgramUrl}>посилання</TextLink>
                      </p>
                    )}
                  </div>
                  {reg.submittedAt && (
                    <p className="text-xs text-muted-foreground">
                      Подано: <LocalDateTime date={reg.submittedAt} />
                    </p>
                  )}
                  {reg.status === 'REJECTED' && reg.rejectionReason && (
                    <p className="text-xs text-error">Відхилено: {reg.rejectionReason}</p>
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
            <p className="text-sm text-foreground">
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

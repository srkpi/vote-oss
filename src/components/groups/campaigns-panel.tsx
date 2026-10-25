'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarClock,
  ExternalLink,
  FileText,
  Megaphone,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';

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
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { CAMPAIGN_STATE_BADGE, ELECTION_KIND_LABEL } from '@/lib/campaigns-display';
import {
  CAMPAIGN_POSITION_TITLE_MAX_LENGTH,
  CAMPAIGN_SIGNATURE_QUORUM_MAX,
  CAMPAIGN_SIGNATURE_QUORUM_MIN,
  CAMPAIGN_TEAM_SIZE_MAX,
  CAMPAIGN_TEAM_SIZE_MIN,
  CAMPAIGNS_PAGE_SIZE,
} from '@/lib/constants';
import {
  createCampaignFormSchema,
  serializeCampaignSchedule,
  type CampaignFormValues,
} from '@/lib/schemas/campaign-form';
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
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ElectionCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(campaigns.length / CAMPAIGNS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = campaigns.slice(
    (safePage - 1) * CAMPAIGNS_PAGE_SIZE,
    safePage * CAMPAIGNS_PAGE_SIZE,
  );

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
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
    <div className="border-border-color rounded-xl border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-kpi-gray-mid" />
          <h2 className="font-display text-base font-semibold text-foreground">Вибори</h2>
        </div>
        <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span className="font-body text-sm">Нові</span>
        </Button>
      </div>

      {initialLoadError ? (
        <div className="p-4">
          <Alert variant="error">{initialLoadError}</Alert>
        </div>
      ) : campaigns.length === 0 ? (
        <p className="font-body px-5 py-8 text-center text-sm text-muted-foreground">
          У цій групі ще немає виборчих кампаній
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {paged.map((c) => {
            const badge = CAMPAIGN_STATE_BADGE[c.state];
            return (
              <li key={c.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {c.positionTitle}
                      <StatusBadge status={badge.kind} size="sm" label={badge.label} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ELECTION_KIND_LABEL[c.electionKind]}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/groups/${groupId}/campaigns/${c.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Відкрити</span>
                      </Link>
                    </Button>
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

      {totalPages > 1 && (
        <div className="border-t border-border-subtle px-5 py-3">
          <Pagination page={safePage} totalPages={totalPages} setPage={setPage} />
        </div>
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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function campaignDefaults(): CampaignFormValues {
  const announcedAt = defaultAnnouncedAt();
  const registrationClosesAt = new Date(announcedAt.getTime() + 7 * DAY_MS);
  const signaturesOpensAt = new Date(registrationClosesAt.getTime() + 2 * DAY_MS);
  const signaturesClosesAt = new Date(signaturesOpensAt.getTime() + 7 * DAY_MS);
  const votingOpensAt = new Date(signaturesClosesAt.getTime() + 2 * DAY_MS);
  return {
    positionTitle: '',
    electionKind: 'REGULAR',
    announcedAt,
    registrationClosesAt,
    signatureCollection: false,
    signaturesOpensAt,
    signaturesClosesAt,
    signatureQuorum: 100,
    teamSize: 0,
    requiresCampaignProgram: false,
    votingOpensAt,
    votingClosesAt: new Date(votingOpensAt.getTime() + 3 * DAY_MS),
    faculties: [],
  };
}
function CampaignCreateDialog({ groupId, open, onClose, onCreated }: CampaignCreateDialogProps) {
  const {
    register,
    control,
    handleSubmit: submitForm,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting: submitting },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(createCampaignFormSchema()),
    defaultValues: campaignDefaults(),
  });
  const { positionTitle, signatureCollection } = useWatch({ control }) as CampaignFormValues;
  const error = errors.root?.message;
  const [facultyOptions, setFacultyOptions] = useState<string[]>([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);

  // Re-renders every minute so date-pickers and validation stay in sync with "now".
  const [renderNowMs, setRenderNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) {
      return;
    }
    const id = setInterval(() => setRenderNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [open]);
  const minFutureDate = new Date(renderNowMs + 60 * 1000);

  useEffect(() => {
    if (open) {
      reset(campaignDefaults());
    }
  }, [open, reset]);

  // Load faculty list once.
  useEffect(() => {
    if (!open) {
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
  }, [open, facultyOptions.length]);

  const handleSubmit = submitForm(async (values) => {
    clearErrors('root');
    const { faculties, signatureQuorum, ...fields } = values;
    const restrictions: ElectionCampaignRestriction[] = faculties.map((value) => ({
      type: 'FACULTY',
      value,
    }));
    const result = await api.groups.campaigns.create(groupId, {
      ...fields,
      ...serializeCampaignSchedule(values),
      signatureQuorum: values.signatureCollection ? signatureQuorum : null,
      restrictions,
    });
    if (result.success) {
      onCreated(result.data);
    } else {
      setError('root', { message: result.error });
    }
  });
  const canSubmit = !!positionTitle.trim() && !submitting;

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()}>
      <DialogPanel maxWidth="lg">
        <DialogHeader>
          <DialogTitle>Нова виборча кампанія</DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="error" onDismiss={() => clearErrors('root')}>
              {error}
            </Alert>
          )}

          <FormField
            label="Тип посади"
            required
            htmlFor="position-title"
            error={errors.positionTitle?.message}
          >
            <Input
              id="position-title"
              {...register('positionTitle')}
              maxLength={CAMPAIGN_POSITION_TITLE_MAX_LENGTH}
              placeholder="Наприклад: Голова студради ФІОТ"
            />
          </FormField>

          <FormField label="Тип виборів" required>
            <select
              className="border-border-color w-full rounded-md border bg-card px-3 py-2 text-sm"
              {...register('electionKind')}
            >
              {(Object.keys(ELECTION_KIND_LABEL) as ElectionKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {ELECTION_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Початок реєстрації"
              required
              htmlFor="announced-at"
              error={errors.announcedAt?.message}
            >
              <Controller
                control={control}
                name="announcedAt"
                render={({ field }) => (
                  <KyivDateTimePicker
                    id="announced-at"
                    value={field.value}
                    onChange={field.onChange}
                    ref={field.ref}
                    min={minFutureDate}
                    minuteStep={30}
                  />
                )}
              />
            </FormField>
            <FormField
              label="Кінець реєстрації"
              required
              htmlFor="registration-closes-at"
              error={errors.registrationClosesAt?.message}
            >
              <Controller
                control={control}
                name="registrationClosesAt"
                render={({ field }) => (
                  <KyivDateTimePicker
                    id="registration-closes-at"
                    value={field.value}
                    onChange={field.onChange}
                    ref={field.ref}
                    min={minFutureDate}
                    minuteStep={30}
                  />
                )}
              />
            </FormField>
          </div>

          <FormField label="Збір підписів">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('signatureCollection')} />
              <span>Кандидати мають зібрати підписи перед фінальним голосуванням</span>
            </label>
          </FormField>

          {signatureCollection && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="Початок збору підписів"
                required
                htmlFor="signatures-opens-at"
                error={errors.signaturesOpensAt?.message}
              >
                <Controller
                  control={control}
                  name="signaturesOpensAt"
                  render={({ field }) => (
                    <KyivDateTimePicker
                      id="signatures-opens-at"
                      value={field.value}
                      onChange={field.onChange}
                      ref={field.ref}
                      min={minFutureDate}
                      minuteStep={30}
                    />
                  )}
                />
              </FormField>
              <FormField
                label="Кінець збору підписів"
                required
                htmlFor="signatures-closes-at"
                error={errors.signaturesClosesAt?.message}
              >
                <Controller
                  control={control}
                  name="signaturesClosesAt"
                  render={({ field }) => (
                    <KyivDateTimePicker
                      id="signatures-closes-at"
                      value={field.value}
                      onChange={field.onChange}
                      ref={field.ref}
                      min={minFutureDate}
                      minuteStep={30}
                    />
                  )}
                />
              </FormField>
              <FormField
                label="Кворум підписів"
                required
                htmlFor="signature-quorum"
                error={errors.signatureQuorum?.message}
              >
                <Input
                  id="signature-quorum"
                  type="number"
                  min={CAMPAIGN_SIGNATURE_QUORUM_MIN}
                  max={CAMPAIGN_SIGNATURE_QUORUM_MAX}
                  {...register('signatureQuorum', {
                    setValueAs: (value) => (value === '' ? null : Number(value)),
                  })}
                />
              </FormField>
            </div>
          )}

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
                    min={CAMPAIGN_TEAM_SIZE_MIN}
                    max={CAMPAIGN_TEAM_SIZE_MAX}
                    {...register('teamSize', { valueAsNumber: true })}
                    className="w-20"
                  />
                </label>
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Початок голосування"
              required
              htmlFor="voting-opens-at"
              error={errors.votingOpensAt?.message}
            >
              <Controller
                control={control}
                name="votingOpensAt"
                render={({ field }) => (
                  <KyivDateTimePicker
                    id="voting-opens-at"
                    value={field.value}
                    onChange={field.onChange}
                    ref={field.ref}
                    min={minFutureDate}
                    minuteStep={30}
                  />
                )}
              />
            </FormField>
            <FormField
              label="Кінець голосування"
              required
              htmlFor="voting-closes-at"
              error={errors.votingClosesAt?.message}
            >
              <Controller
                control={control}
                name="votingClosesAt"
                render={({ field }) => (
                  <KyivDateTimePicker
                    id="voting-closes-at"
                    value={field.value}
                    onChange={field.onChange}
                    ref={field.ref}
                    min={minFutureDate}
                    minuteStep={30}
                  />
                )}
              />
            </FormField>
          </div>

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

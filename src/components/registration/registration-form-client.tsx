'use client';

import { CheckCircle2, Clock, FileText, ShieldCheck, Users, XCircle } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
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
import { FormField, Input } from '@/components/ui/form';
import { LocalDateTime } from '@/components/ui/local-time';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  REGISTRATION_PHONE_MAX_LENGTH,
  REGISTRATION_PROGRAM_URL_ALLOWED_HOSTS,
  REGISTRATION_PROGRAM_URL_MAX_LENGTH,
  REGISTRATION_TELEGRAM_TAG_MAX_LENGTH,
} from '@/lib/constants';
import {
  validateCampaignProgramUrl,
  validatePhoneNumber,
  validateTelegramTag,
} from '@/lib/registration-validators';
import { cn } from '@/lib/utils/common';
import type {
  CandidateRegistration,
  CandidateRegistrationFormDetail,
  CandidateRegistrationStatus,
} from '@/types/candidate-registration';

interface RegistrationFormClientProps {
  initial: CandidateRegistrationFormDetail;
}

const STATUS_LABEL: Record<CandidateRegistrationStatus, string> = {
  DRAFT: 'Чернетка',
  AWAITING_TEAM: 'Очікує підтвердження команди',
  PENDING_REVIEW: 'На розгляді',
  APPROVED: 'Затверджено',
  REJECTED: 'Відхилено',
  WITHDRAWN: 'Відкликано',
};

const STATUS_BADGE: Record<CandidateRegistrationStatus, string> = {
  DRAFT: 'text-muted-foreground bg-surface',
  AWAITING_TEAM: 'text-kpi-orange bg-warning-bg',
  PENDING_REVIEW: 'text-kpi-navy bg-kpi-navy/10',
  APPROVED: 'text-success bg-success-bg',
  REJECTED: 'text-error bg-error-bg',
  WITHDRAWN: 'text-muted-foreground bg-gray-100',
};

const NON_FINAL = new Set<CandidateRegistrationStatus>([
  'DRAFT',
  'AWAITING_TEAM',
  'PENDING_REVIEW',
]);

export function RegistrationFormClient({ initial }: RegistrationFormClientProps) {
  const { toast } = useToast();
  const [form] = useState(initial);
  const [registration, setRegistration] = useState<CandidateRegistration | null>(
    initial.myRegistration,
  );

  const editable = !registration || registration.status === 'DRAFT';

  const [phone, setPhone] = useState(registration?.phoneNumber ?? '');
  const [tag, setTag] = useState(registration?.telegramTag ?? '');
  const [programUrl, setProgramUrl] = useState(registration?.campaignProgramUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = registration?.status ?? null;
  const [now] = useState(() => Date.now());
  const closed = now > new Date(form.closesAt).getTime();
  const notYetOpen = now < new Date(form.opensAt).getTime();

  const phoneCheck = phone.trim() ? validatePhoneNumber(phone) : null;
  const tagCheck = tag.trim() ? validateTelegramTag(tag) : null;
  const programCheck =
    form.requiresCampaignProgram && programUrl.trim()
      ? validateCampaignProgramUrl(programUrl)
      : null;
  const phoneError = phoneCheck && !phoneCheck.ok ? phoneCheck.error : null;
  const tagError = tagCheck && !tagCheck.ok ? tagCheck.error : null;
  const programError = programCheck && !programCheck.ok ? programCheck.error : null;
  const hasFieldErrors = !!(phoneError || tagError || programError);
  const allRequiredFilled =
    phone.trim().length > 0 && (!form.requiresCampaignProgram || programUrl.trim().length > 0);
  const canSubmit = !hasFieldErrors && allRequiredFilled;

  const saveDraft = async (): Promise<CandidateRegistration | null> => {
    setSaving(true);
    setError(null);
    const result = await api.registrationForms.saveDraft(form.id, {
      phoneNumber: phone,
      telegramTag: tag,
      campaignProgramUrl: form.requiresCampaignProgram ? programUrl : null,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return null;
    }
    setRegistration(result.data);
    return result.data;
  };

  const handleSaveDraft = async () => {
    const saved = await saveDraft();
    if (saved) toast({ title: 'Чернетку збережено', variant: 'success' });
  };

  const handleSubmit = async () => {
    const saved = await saveDraft();
    if (!saved) return;

    setSubmitting(true);
    const result = await api.registrations.submit(saved.id);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRegistration(result.data);
    toast({
      title:
        result.data.status === 'AWAITING_TEAM'
          ? 'Заявку подано — очікує підтвердження команди'
          : 'Заявку подано на розгляд',
      variant: 'success',
    });
  };

  const handleWithdraw = async () => {
    if (!registration) return;
    setWithdrawing(true);
    const wasDraft = registration.status === 'DRAFT';
    const result = await api.registrations.withdraw(registration.id);
    setWithdrawing(false);
    if (!result.success) {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
      return;
    }
    setRegistration(result.data);
    setWithdrawConfirmOpen(false);
    toast({
      title: wasDraft ? 'Чернетку видалено' : 'Заявку відкликано',
      variant: 'success',
    });
  };

  return (
    <>
      <PageHeader
        nav={[{ label: 'Реєстрація', href: '/registration' }, { label: form.title }]}
        title={form.title}
        isContainer
      />
      <div className="container max-w-2xl py-8">
        <div className="border-border-color shadow-shadow-card mb-6 space-y-3 rounded-xl border bg-white p-5">
          {form.description && (
            <p className="text-foreground text-sm whitespace-pre-line">{form.description}</p>
          )}
          <p className="text-muted-foreground text-xs">
            Орган: <span className="text-foreground font-medium">{form.groupName}</span>
          </p>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {form.requiresCampaignProgram && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Потрібна передвиборча програма
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
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              До <LocalDateTime date={form.closesAt} />
            </span>
          </div>
        </div>

        {!form.eligible && (
          <Alert variant="error" title="Ви не відповідаєте обмеженням" className="mb-6">
            Подати заявку на цю форму можуть лише користувачі, що задовольняють обмеження.
          </Alert>
        )}

        {notYetOpen && (
          <Alert variant="info" className="mb-6">
            Прийом заявок ще не відкрито. Початок: <LocalDateTime date={form.opensAt} />
          </Alert>
        )}

        {closed && (
          <Alert variant="warning" className="mb-6">
            Прийом заявок завершено.
          </Alert>
        )}

        {status && (
          <div className="border-border-color shadow-shadow-card mb-6 rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2">
              {status === 'APPROVED' ? (
                <CheckCircle2 className="text-success h-4 w-4" />
              ) : status === 'REJECTED' || status === 'WITHDRAWN' ? (
                <XCircle className="text-muted-foreground h-4 w-4" />
              ) : (
                <Clock className="text-kpi-navy h-4 w-4" />
              )}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                  STATUS_BADGE[status],
                )}
              >
                {STATUS_LABEL[status]}
              </span>
              {registration?.submittedAt && (
                <span className="text-muted-foreground text-xs">
                  Подано: <LocalDateTime date={registration.submittedAt} />
                </span>
              )}
            </div>
            {status === 'AWAITING_TEAM' && (
              <p className="text-muted-foreground mt-2 text-sm">
                Згенеруйте посилання нижче і надішліть їх членам команди. Коли учасник перейде за
                посиланням і прийме запрошення — підтвердьте або відхиліть його у себе. Щойно ви
                підтвердите всіх — заявка автоматично піде на розгляд.
              </p>
            )}
            {status === 'REJECTED' && registration?.rejectionReason && (
              <div className="mt-3">
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  Причина відхилення
                </p>
                <p className="text-foreground mt-1 text-sm whitespace-pre-line">
                  {registration.rejectionReason}
                </p>
              </div>
            )}
            {registration?.reviewedByFullName && (
              <p className="text-muted-foreground mt-2 text-xs">
                Розглянув: {registration.reviewedByFullName}
                {registration.reviewedAt && (
                  <>
                    {' '}
                    — <LocalDateTime date={registration.reviewedAt} />
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {registration && status !== null && status !== 'DRAFT' && (
          <div className="border-border-color shadow-shadow-card mb-6 space-y-3 rounded-xl border bg-white p-5">
            <p className="font-display text-foreground text-sm font-semibold">Ваша заявка</p>
            <dl className="grid items-baseline gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted-foreground text-xs uppercase">Телефон</dt>
              <dd className="text-foreground wrap-break-word">{registration.phoneNumber}</dd>
              {registration.telegramTag && (
                <>
                  <dt className="text-muted-foreground text-xs uppercase">Telegram</dt>
                  <dd className="text-foreground wrap-break-word">{registration.telegramTag}</dd>
                </>
              )}
              {form.requiresCampaignProgram && registration.campaignProgramUrl && (
                <>
                  <dt className="text-muted-foreground text-xs uppercase">Програма</dt>
                  <dd className="wrap-break-word">
                    <a
                      href={registration.campaignProgramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-kpi-navy hover:underline"
                    >
                      {registration.campaignProgramUrl}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        {registration && form.teamSize > 0 && status !== null && status !== 'DRAFT' && (
          <TeamSlotsPanel
            registrationId={registration.id}
            readOnly={status !== 'AWAITING_TEAM'}
            onRegistrationStatusChange={(next) =>
              setRegistration((prev) =>
                prev ? { ...prev, status: next, submittedAt: prev.submittedAt ?? null } : prev,
              )
            }
          />
        )}

        {editable && form.eligible && !closed && !notYetOpen && (
          <div className="border-border-color shadow-shadow-card space-y-4 rounded-xl border bg-white p-5">
            {error && (
              <Alert variant="error" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            )}

            <FormField
              label="Номер телефону"
              required
              htmlFor="phone"
              error={phoneError ?? undefined}
              hint={
                phoneError
                  ? undefined
                  : 'Формат E.164: «+» та код країни, наприклад +380 XX XXX XX XX'
              }
            >
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380 XX XXX XX XX"
                maxLength={REGISTRATION_PHONE_MAX_LENGTH}
                error={!!phoneError}
                inputMode="tel"
              />
            </FormField>

            <FormField
              label="Telegram-тег (необовʼязково)"
              htmlFor="telegram"
              error={tagError ?? undefined}
              hint={
                tagError
                  ? undefined
                  : 'Наприклад: @username — 5–32 латинських символи, цифри або _, починається з літери'
              }
            >
              <Input
                id="telegram"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="@username"
                maxLength={REGISTRATION_TELEGRAM_TAG_MAX_LENGTH}
                error={!!tagError}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </FormField>

            {form.requiresCampaignProgram && (
              <FormField
                label="Передвиборча програма (Google Drive)"
                required
                htmlFor="program"
                error={programError ?? undefined}
                hint={
                  programError
                    ? undefined
                    : `Посилання https на ${REGISTRATION_PROGRAM_URL_ALLOWED_HOSTS.join(' або ')}`
                }
              >
                <Input
                  id="program"
                  value={programUrl}
                  onChange={(e) => setProgramUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  maxLength={REGISTRATION_PROGRAM_URL_MAX_LENGTH}
                  error={!!programError}
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </FormField>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                loading={saving}
                disabled={hasFieldErrors}
              >
                Зберегти чернетку
              </Button>
              <Button
                variant="accent"
                onClick={handleSubmit}
                loading={submitting}
                disabled={!canSubmit}
              >
                Подати заявку
              </Button>
              {registration?.status === 'DRAFT' && (
                <Button
                  variant="ghost"
                  onClick={() => setWithdrawConfirmOpen(true)}
                  disabled={withdrawing}
                >
                  Видалити чернетку
                </Button>
              )}
            </div>
          </div>
        )}

        {registration && NON_FINAL.has(registration.status) && registration.status !== 'DRAFT' && (
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setWithdrawConfirmOpen(true)}
              disabled={withdrawing}
            >
              Відкликати заявку
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={withdrawConfirmOpen}
        onClose={() => !withdrawing && setWithdrawConfirmOpen(false)}
      >
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>
              {registration?.status === 'DRAFT' ? 'Видалити чернетку?' : 'Відкликати заявку?'}
            </DialogTitle>
            <DialogCloseButton onClose={() => setWithdrawConfirmOpen(false)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              {registration?.status === 'DRAFT'
                ? 'Чернетку буде видалено. Якщо потім захочете подати заявку, потрібно буде заповнити форму заново.'
                : 'Заявку буде відкликано і поданню не підлягатиме. Якщо потім захочете балотуватись, нову заявку на цю форму подати неможливо.'}
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setWithdrawConfirmOpen(false)}
              disabled={withdrawing}
            >
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleWithdraw} loading={withdrawing}>
              {registration?.status === 'DRAFT' ? 'Видалити' : 'Відкликати'}
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </>
  );
}

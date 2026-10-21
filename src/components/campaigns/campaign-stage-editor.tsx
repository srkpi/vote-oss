'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Pencil, ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge, type StatusKind } from '@/components/ui/status-badge';
import { api } from '@/lib/api/browser';
import { computeCampaignStageEditabilityFromApi } from '@/lib/campaign-stage-editability';
import { CAMPAIGN_STATE_BADGE } from '@/lib/campaigns-display';
import {
  createCampaignScheduleSchema,
  campaignScheduleDefaults,
  serializeCampaignSchedule,
  type CampaignScheduleValues,
} from '@/lib/schemas/campaign-form';
import type {
  CampaignBoundaryEditability,
  CampaignState,
  ElectionCampaign,
} from '@/types/campaign';

interface CampaignStageEditorProps {
  campaign: ElectionCampaign;
}

interface TimelineEntry {
  state: CampaignState;
  startsAt: Date;
  endsAt: Date;
}

function buildTimeline(c: ElectionCampaign): TimelineEntry[] {
  const announced = new Date(c.announcedAt);
  const registrationCloses = new Date(c.registrationClosesAt);
  const votingOpens = new Date(c.votingOpensAt);
  const votingCloses = new Date(c.votingClosesAt);

  const hasSignaturePhase =
    c.signatureCollection && c.signaturesOpensAt !== null && c.signaturesClosesAt !== null;
  const signaturesOpens = hasSignaturePhase ? new Date(c.signaturesOpensAt!) : null;
  const signaturesCloses = hasSignaturePhase ? new Date(c.signaturesClosesAt!) : null;

  const out: TimelineEntry[] = [
    {
      state: 'REGISTRATION_OPEN',
      startsAt: announced,
      endsAt: registrationCloses,
    },
    {
      state: 'REGISTRATION_REVIEW',
      startsAt: registrationCloses,
      endsAt: hasSignaturePhase ? signaturesOpens! : votingOpens,
    },
  ];

  if (hasSignaturePhase) {
    out.push(
      { state: 'SIGNATURES_OPEN', startsAt: signaturesOpens!, endsAt: signaturesCloses! },
      { state: 'SIGNATURES_REVIEW', startsAt: signaturesCloses!, endsAt: votingOpens },
    );
  }

  out.push({
    state: 'VOTING_OPEN',
    startsAt: votingOpens,
    endsAt: votingCloses,
  });

  // Hide zero-duration phases (e.g. review windows the user collapsed to 0).
  return out.filter((e) => e.endsAt.getTime() > e.startsAt.getTime());
}

// Linear ordering of timeline-relevant states.  CANCELLED/FAILED/COMPLETED are
// terminal and treated as "everything past" below.
const STATE_ORDER: CampaignState[] = [
  'ANNOUNCED',
  'REGISTRATION_OPEN',
  'REGISTRATION_REVIEW',
  'SIGNATURES_OPEN',
  'SIGNATURES_REVIEW',
  'VOTING_OPEN',
  'VOTING_CLOSED',
];

const TERMINAL_STATES = new Set<CampaignState>(['CANCELLED', 'FAILED', 'COMPLETED']);

function timelineEntryBadge(
  entry: CampaignState,
  current: CampaignState,
): { kind: StatusKind; label: string } {
  const fullLabel = CAMPAIGN_STATE_BADGE[entry].label;
  if (entry === current) {
    return CAMPAIGN_STATE_BADGE[entry];
  }
  if (current === 'COMPLETED' || current === 'FAILED' || current === 'CANCELLED') {
    return { kind: 'closed', label: fullLabel };
  }
  const entryIdx = STATE_ORDER.indexOf(entry);
  const currentIdx = STATE_ORDER.indexOf(current);
  if (entryIdx < currentIdx) {
    return { kind: 'closed', label: fullLabel };
  }
  return { kind: 'upcoming', label: fullLabel };
}

function editabilityHint(state: CampaignBoundaryEditability): string | undefined {
  if (state === 'locked') {
    return 'Вже минуло — редагування недоступне';
  }
  if (state === 'extend_only') {
    return 'Вже триває — можна лише перенести на пізніше';
  }
  return undefined;
}

interface BoundaryFieldProps {
  id: string;
  label: string;
  value: Date;
  /** The value as it was when editing started — the floor for 'extend_only' fields. */
  original: Date;
  editability: CampaignBoundaryEditability;
  minFutureDate: Date;
  onChange: (d: Date) => void;
  error?: string;
}

function BoundaryField({
  id,
  label,
  value,
  original,
  editability,
  minFutureDate,
  onChange,
  error,
}: BoundaryFieldProps) {
  const locked = editability === 'locked';
  const min =
    editability === 'extend_only'
      ? original
      : editability === 'editable'
        ? minFutureDate
        : undefined;
  return (
    <FormField
      label={label}
      required
      htmlFor={id}
      hint={editabilityHint(editability)}
      error={error}
    >
      <div className="flex items-center gap-2">
        {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <KyivDateTimePicker
          id={id}
          value={value}
          onChange={onChange}
          disabled={locked}
          min={min}
          minuteStep={30}
          className="flex-1"
        />
      </div>
    </FormField>
  );
}

export function CampaignStageEditor({ campaign: initialCampaign }: CampaignStageEditorProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setCampaign(initialCampaign);
  }, [initialCampaign]);

  // Re-derive editability every 30s so a field's lock state can never be
  // stale relative to the server if this page is left open across a
  // boundary passing.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const editability = computeCampaignStageEditabilityFromApi(campaign, new Date(nowMs));
  const hasSignaturePhase =
    campaign.signaturesOpensAt !== null && campaign.signaturesClosesAt !== null;
  const isTerminal = TERMINAL_STATES.has(campaign.state);
  const anyEditable =
    !isTerminal && Object.values(editability).some((v) => v === 'editable' || v === 'extend_only');

  const [editing, setEditing] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting: submitting },
  } = useForm<CampaignScheduleValues>({
    resolver: zodResolver(createCampaignScheduleSchema(campaign)),
    defaultValues: campaignScheduleDefaults(campaign),
  });
  const { signaturesOpensAt, signaturesClosesAt } = useWatch({ control });
  const error = errors.root?.message;
  const startEditing = () => {
    reset(campaignScheduleDefaults(campaign));
    setEditing(true);
  };
  const minFutureDate = new Date(nowMs + 60 * 1000);
  const handleSave = handleSubmit(async (values) => {
    clearErrors('root');
    const result = await api.campaigns.update(campaign.id, serializeCampaignSchedule(values));
    if (result.success) {
      setCampaign(result.data);
      setEditing(false);
      router.refresh();
    } else {
      setError('root', { message: result.error });
    }
  });

  const timeline = buildTimeline(campaign);

  return (
    <section className="border-border-color rounded-xl border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-kpi-gray-mid" />
          <h2 className="font-display text-base font-semibold text-foreground">Етапи кампанії</h2>
        </div>
        {anyEditable && !editing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Редагувати</span>
          </Button>
        )}
      </header>

      {!editing ? (
        <ol className="divide-y divide-border-subtle">
          {timeline.map((entry) => {
            const stageBadge = timelineEntryBadge(entry.state, campaign.state);
            return (
              <li
                key={entry.state}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={stageBadge.kind} label={stageBadge.label} size="sm" />
                </div>
                <span className="text-xs text-muted-foreground">
                  <LocalDateTime date={entry.startsAt.toISOString()} /> —{' '}
                  <LocalDateTime date={entry.endsAt.toISOString()} />
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="space-y-4 px-5 py-4">
          {error && (
            <Alert variant="error" onDismiss={() => clearErrors('root')}>
              {error}
            </Alert>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Реєстрація
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Controller
                control={control}
                name="announcedAt"
                render={({ field }) => (
                  <BoundaryField
                    id="edit-announced-at"
                    label="Початок реєстрації"
                    value={field.value!}
                    original={new Date(campaign.announcedAt)}
                    editability={editability.announcedAt}
                    minFutureDate={minFutureDate}
                    onChange={field.onChange}
                    error={errors.announcedAt?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="registrationClosesAt"
                render={({ field }) => (
                  <BoundaryField
                    id="edit-registration-closes-at"
                    label="Кінець реєстрації"
                    value={field.value!}
                    original={new Date(campaign.registrationClosesAt)}
                    editability={editability.registrationClosesAt}
                    minFutureDate={minFutureDate}
                    onChange={field.onChange}
                    error={errors.registrationClosesAt?.message}
                  />
                )}
              />
            </div>
          </div>

          {hasSignaturePhase && signaturesOpensAt && signaturesClosesAt && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Збір підписів
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="signaturesOpensAt"
                  render={({ field }) => (
                    <BoundaryField
                      id="edit-signatures-opens-at"
                      label="Початок збору підписів"
                      value={field.value!}
                      original={new Date(campaign.signaturesOpensAt!)}
                      editability={editability.signaturesOpensAt!}
                      minFutureDate={minFutureDate}
                      onChange={field.onChange}
                      error={errors.signaturesOpensAt?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="signaturesClosesAt"
                  render={({ field }) => (
                    <BoundaryField
                      id="edit-signatures-closes-at"
                      label="Кінець збору підписів"
                      value={field.value!}
                      original={new Date(campaign.signaturesClosesAt!)}
                      editability={editability.signaturesClosesAt!}
                      minFutureDate={minFutureDate}
                      onChange={field.onChange}
                      error={errors.signaturesClosesAt?.message}
                    />
                  )}
                />
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Голосування
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Controller
                control={control}
                name="votingOpensAt"
                render={({ field }) => (
                  <BoundaryField
                    id="edit-voting-opens-at"
                    label="Початок голосування"
                    value={field.value!}
                    original={new Date(campaign.votingOpensAt)}
                    editability={editability.votingOpensAt}
                    minFutureDate={minFutureDate}
                    onChange={field.onChange}
                    error={errors.votingOpensAt?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="votingClosesAt"
                render={({ field }) => (
                  <BoundaryField
                    id="edit-voting-closes-at"
                    label="Кінець голосування"
                    value={field.value!}
                    original={new Date(campaign.votingClosesAt)}
                    editability={editability.votingClosesAt}
                    minFutureDate={minFutureDate}
                    onChange={field.onChange}
                    error={errors.votingClosesAt?.message}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={submitting}
            >
              Скасувати
            </Button>
            <Button variant="accent" size="sm" onClick={handleSave} loading={submitting}>
              Зберегти
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import { Lock, Pencil, ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge, type StatusKind } from '@/components/ui/status-badge';
import { api } from '@/lib/api/browser';
import { computeCampaignStageEditabilityFromApi } from '@/lib/campaign-stage-editability';
import { CAMPAIGN_STATE_BADGE } from '@/lib/campaigns-display';
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
  if (entry === current) return CAMPAIGN_STATE_BADGE[entry];
  if (current === 'COMPLETED' || current === 'FAILED' || current === 'CANCELLED') {
    return { kind: 'closed', label: fullLabel };
  }
  const entryIdx = STATE_ORDER.indexOf(entry);
  const currentIdx = STATE_ORDER.indexOf(current);
  if (entryIdx < currentIdx) return { kind: 'closed', label: fullLabel };
  return { kind: 'upcoming', label: fullLabel };
}

function editabilityHint(state: CampaignBoundaryEditability): string | undefined {
  if (state === 'locked') return 'Вже минуло — редагування недоступне';
  if (state === 'extend_only') return 'Вже триває — можна лише перенести на пізніше';
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
}

function BoundaryField({
  id,
  label,
  value,
  original,
  editability,
  minFutureDate,
  onChange,
}: BoundaryFieldProps) {
  const locked = editability === 'locked';
  const min =
    editability === 'extend_only'
      ? original
      : editability === 'editable'
        ? minFutureDate
        : undefined;
  return (
    <FormField label={label} required htmlFor={id} hint={editabilityHint(editability)}>
      <div className="flex items-center gap-2">
        {locked && <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />}
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const [announcedAt, setAnnouncedAt] = useState(() => new Date(campaign.announcedAt));
  const [registrationClosesAt, setRegistrationClosesAt] = useState(
    () => new Date(campaign.registrationClosesAt),
  );
  const [signaturesOpensAt, setSignaturesOpensAt] = useState<Date | null>(
    campaign.signaturesOpensAt ? new Date(campaign.signaturesOpensAt) : null,
  );
  const [signaturesClosesAt, setSignaturesClosesAt] = useState<Date | null>(
    campaign.signaturesClosesAt ? new Date(campaign.signaturesClosesAt) : null,
  );
  const [votingOpensAt, setVotingOpensAt] = useState(() => new Date(campaign.votingOpensAt));
  const [votingClosesAt, setVotingClosesAt] = useState(() => new Date(campaign.votingClosesAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setAnnouncedAt(new Date(campaign.announcedAt));
    setRegistrationClosesAt(new Date(campaign.registrationClosesAt));
    setSignaturesOpensAt(campaign.signaturesOpensAt ? new Date(campaign.signaturesOpensAt) : null);
    setSignaturesClosesAt(
      campaign.signaturesClosesAt ? new Date(campaign.signaturesClosesAt) : null,
    );
    setVotingOpensAt(new Date(campaign.votingOpensAt));
    setVotingClosesAt(new Date(campaign.votingClosesAt));
    setError(null);
    setEditing(true);
  };

  const minFutureDate = new Date(nowMs + 60 * 1000);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    const result = await api.campaigns.update(campaign.id, {
      announcedAt: announcedAt.toISOString(),
      registrationClosesAt: registrationClosesAt.toISOString(),
      signaturesOpensAt: hasSignaturePhase ? signaturesOpensAt!.toISOString() : null,
      signaturesClosesAt: hasSignaturePhase ? signaturesClosesAt!.toISOString() : null,
      votingOpensAt: votingOpensAt.toISOString(),
      votingClosesAt: votingClosesAt.toISOString(),
    });
    if (result.success) {
      setCampaign(result.data);
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  };

  const timeline = buildTimeline(campaign);

  return (
    <section className="border-border-color shadow-card rounded-xl border bg-white">
      <header className="border-border-subtle flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <ScrollText className="text-kpi-gray-mid h-4 w-4" />
          <h2 className="font-display text-foreground text-base font-semibold">Етапи кампанії</h2>
        </div>
        {anyEditable && !editing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5" />
            <span>Редагувати</span>
          </Button>
        )}
      </header>

      {!editing ? (
        <ol className="divide-border-subtle divide-y">
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
                <span className="text-muted-foreground text-xs">
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
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Реєстрація
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BoundaryField
                id="edit-announced-at"
                label="Початок реєстрації"
                value={announcedAt}
                original={new Date(campaign.announcedAt)}
                editability={editability.announcedAt}
                minFutureDate={minFutureDate}
                onChange={setAnnouncedAt}
              />
              <BoundaryField
                id="edit-registration-closes-at"
                label="Кінець реєстрації"
                value={registrationClosesAt}
                original={new Date(campaign.registrationClosesAt)}
                editability={editability.registrationClosesAt}
                minFutureDate={minFutureDate}
                onChange={setRegistrationClosesAt}
              />
            </div>
          </div>

          {hasSignaturePhase && signaturesOpensAt && signaturesClosesAt && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Збір підписів
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BoundaryField
                  id="edit-signatures-opens-at"
                  label="Початок збору підписів"
                  value={signaturesOpensAt}
                  original={new Date(campaign.signaturesOpensAt!)}
                  editability={editability.signaturesOpensAt!}
                  minFutureDate={minFutureDate}
                  onChange={setSignaturesOpensAt}
                />
                <BoundaryField
                  id="edit-signatures-closes-at"
                  label="Кінець збору підписів"
                  value={signaturesClosesAt}
                  original={new Date(campaign.signaturesClosesAt!)}
                  editability={editability.signaturesClosesAt!}
                  minFutureDate={minFutureDate}
                  onChange={setSignaturesClosesAt}
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Голосування
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BoundaryField
                id="edit-voting-opens-at"
                label="Початок голосування"
                value={votingOpensAt}
                original={new Date(campaign.votingOpensAt)}
                editability={editability.votingOpensAt}
                minFutureDate={minFutureDate}
                onChange={setVotingOpensAt}
              />
              <BoundaryField
                id="edit-voting-closes-at"
                label="Кінець голосування"
                value={votingClosesAt}
                original={new Date(campaign.votingClosesAt)}
                editability={editability.votingClosesAt}
                minFutureDate={minFutureDate}
                onChange={setVotingClosesAt}
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

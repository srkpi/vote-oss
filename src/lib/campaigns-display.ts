/**
 * Display labels and badge mappings for ElectionCampaign — shared between the
 * group-level CampaignsPanel and the per-campaign dashboard page so both
 * surfaces speak the same vocabulary.
 */

import type { StatusKind } from '@/components/ui/status-badge';
import type { CampaignState, ElectionKind } from '@/types/campaign';

export const ELECTION_KIND_LABEL: Record<ElectionKind, string> = {
  REGULAR: 'Чергові',
  BY_ELECTION: 'Позачергові на дообрання',
  REPLACEMENT: 'Позачергові на заміщення',
  REPEAT: 'Повторні',
};

export const CAMPAIGN_STATE_BADGE: Record<CampaignState, { kind: StatusKind; label: string }> = {
  ANNOUNCED: { kind: 'upcoming', label: 'Оголошено' },
  REGISTRATION_OPEN: { kind: 'open', label: 'Реєстрація' },
  REGISTRATION_REVIEW: { kind: 'pending', label: 'Розгляд заявок' },
  SIGNATURES_OPEN: { kind: 'open', label: 'Збір підписів' },
  SIGNATURES_REVIEW: { kind: 'pending', label: 'Розгляд підписів' },
  VOTING_OPEN: { kind: 'open', label: 'Голосування' },
  VOTING_CLOSED: { kind: 'closed', label: 'Підрахунок' },
  COMPLETED: { kind: 'closed', label: 'Завершено' },
  FAILED: { kind: 'unavailable', label: 'Не відбулися' },
  CANCELLED: { kind: 'deleted', label: 'Скасовано' },
};

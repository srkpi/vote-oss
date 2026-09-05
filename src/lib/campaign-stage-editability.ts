/**
 * Pure, server/client-agnostic logic for deciding which of a campaign's
 * phase-boundary timestamps may currently be edited. No prisma/db imports
 * here on purpose: `src/lib/campaigns.ts` uses this for PATCH validation,
 * and the campaign dashboard's stage editor imports it directly so its
 * "what can I click on" state ticks forward live with a clock rather than
 * only refreshing on a full page reload — the two must never disagree on
 * the rule, so there is exactly one implementation of it.
 *
 * A campaign's six phase-boundary timestamps form a chain:
 *   announcedAt → registrationClosesAt → [signaturesOpensAt → signaturesClosesAt →]
 *   votingOpensAt → votingClosesAt
 * Each boundary is shared between the stage ending there and the stage
 * starting there. Walking them in order:
 *  - a boundary already in the past is 'locked' — the stage after it has
 *    already begun and can't be un-started;
 *  - the first boundary still in the future belongs to the stage currently
 *    under way, so it's 'extend_only' (may move later, never earlier) —
 *    UNLESS it's the very first boundary of all (announcedAt), which has no
 *    preceding stage to be "under way": a campaign that hasn't begun yet is
 *    'editable' both ways instead;
 *  - every boundary after that is 'editable' (nothing in its stage or
 *    earlier has started).
 */

import type { CampaignStageEditability } from '@/types/campaign';

export interface CampaignBoundaryRow {
  announced_at: Date;
  registration_closes_at: Date;
  signatures_opens_at: Date | null;
  signatures_closes_at: Date | null;
  voting_opens_at: Date;
  voting_closes_at: Date;
}

export function computeCampaignStageEditability(
  campaign: CampaignBoundaryRow,
  now: Date = new Date(),
): CampaignStageEditability {
  const hasSignaturePhase =
    campaign.signatures_opens_at !== null && campaign.signatures_closes_at !== null;

  const order: Array<{ key: keyof CampaignStageEditability; value: Date }> = [
    { key: 'announcedAt', value: campaign.announced_at },
    { key: 'registrationClosesAt', value: campaign.registration_closes_at },
  ];
  if (hasSignaturePhase) {
    order.push(
      { key: 'signaturesOpensAt', value: campaign.signatures_opens_at! },
      { key: 'signaturesClosesAt', value: campaign.signatures_closes_at! },
    );
  }
  order.push(
    { key: 'votingOpensAt', value: campaign.voting_opens_at },
    { key: 'votingClosesAt', value: campaign.voting_closes_at },
  );

  const result: CampaignStageEditability = {
    announcedAt: 'locked',
    registrationClosesAt: 'locked',
    signaturesOpensAt: hasSignaturePhase ? 'locked' : null,
    signaturesClosesAt: hasSignaturePhase ? 'locked' : null,
    votingOpensAt: 'locked',
    votingClosesAt: 'locked',
  };

  let cursorConsumed = false;
  order.forEach(({ key, value }, index) => {
    if (now.getTime() >= value.getTime()) {
      result[key] = 'locked';
      return;
    }
    if (!cursorConsumed) {
      cursorConsumed = true;
      result[key] = index === 0 ? 'editable' : 'extend_only';
      return;
    }
    result[key] = 'editable';
  });

  return result;
}

/** Client-friendly variant that takes the camelCase `ElectionCampaign` API shape directly. */
export function computeCampaignStageEditabilityFromApi(
  campaign: {
    announcedAt: string;
    registrationClosesAt: string;
    signaturesOpensAt: string | null;
    signaturesClosesAt: string | null;
    votingOpensAt: string;
    votingClosesAt: string;
  },
  now: Date = new Date(),
): CampaignStageEditability {
  return computeCampaignStageEditability(
    {
      announced_at: new Date(campaign.announcedAt),
      registration_closes_at: new Date(campaign.registrationClosesAt),
      signatures_opens_at: campaign.signaturesOpensAt ? new Date(campaign.signaturesOpensAt) : null,
      signatures_closes_at: campaign.signaturesClosesAt
        ? new Date(campaign.signaturesClosesAt)
        : null,
      voting_opens_at: new Date(campaign.votingOpensAt),
      voting_closes_at: new Date(campaign.votingClosesAt),
    },
    now,
  );
}

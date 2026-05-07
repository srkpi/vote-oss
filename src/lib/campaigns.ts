/**
 * ElectionCampaign helpers:
 *  - input validation for POST /campaigns
 *  - canonical Prisma include shape and DB → client transformer
 *  - cron transition helper that walks campaigns through their state machine
 *    based on absolute phase-boundary timestamps; spawns the registration
 *    form, per-candidate signature elections, and the final election as the
 *    campaign progresses through its states.
 */

import type { CampaignState, ElectionKind, Prisma, RestrictionType } from '@prisma/client';

import { invalidateElections } from '@/lib/cache';
import { ALLOWED_REGISTRATION_FORM_RESTRICTION_TYPES } from '@/lib/candidate-registration';
import {
  CAMPAIGN_MAX_RESTRICTIONS,
  CAMPAIGN_POSITION_TITLE_MAX_LENGTH,
  CAMPAIGN_RESTRICTION_VALUE_MAX_LENGTH,
  CAMPAIGN_SIGNATURE_QUORUM_MAX,
  CAMPAIGN_SIGNATURE_QUORUM_MIN,
  CAMPAIGN_TEAM_SIZE_MAX,
  CAMPAIGN_TEAM_SIZE_MIN,
  CAMPAIGN_TOTAL_MAX_DURATION_DAYS,
  CAMPAIGN_VOTING_MAX_DURATION_DAYS,
} from '@/lib/constants';
import { generateElectionKeyPair } from '@/lib/crypto';
import { safeDecrypt } from '@/lib/elections-view';
import { encryptField } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import type {
  CreateElectionCampaignRequest,
  ElectionCampaign,
  ElectionCampaignRestriction,
} from '@/types/campaign';

const ELECTION_KINDS: ElectionKind[] = ['REGULAR', 'BY_ELECTION', 'REPLACEMENT', 'REPEAT'];

export const CAMPAIGN_INCLUDE = {
  restrictions: { select: { type: true, value: true } },
  group: { select: { name: true, type: true, deleted_at: true } },
} satisfies Prisma.ElectionCampaignInclude;

export type CampaignWithRelations = Prisma.ElectionCampaignGetPayload<{
  include: typeof CAMPAIGN_INCLUDE;
}>;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function shapeCampaign(campaign: CampaignWithRelations): ElectionCampaign {
  return {
    id: campaign.id,
    groupId: campaign.group_id,
    groupName: campaign.group.name,
    positionTitle: campaign.position_title,
    electionKind: campaign.election_kind,
    state: campaign.state,
    announcedAt: campaign.announced_at.toISOString(),
    registrationClosesAt: campaign.registration_closes_at.toISOString(),
    signaturesOpensAt: campaign.signatures_opens_at?.toISOString() ?? null,
    signaturesClosesAt: campaign.signatures_closes_at?.toISOString() ?? null,
    signatureCollection: campaign.signature_collection,
    signatureQuorum: campaign.signature_quorum,
    teamSize: campaign.team_size,
    requiresCampaignProgram: campaign.requires_campaign_program,
    votingOpensAt: campaign.voting_opens_at.toISOString(),
    votingClosesAt: campaign.voting_closes_at.toISOString(),
    restrictions: campaign.restrictions.map((r) => ({ type: r.type, value: r.value })),
    registrationFormId: campaign.registration_form_id,
    finalElectionId: campaign.final_election_id,
    createdBy: campaign.created_by,
    createdByFullName: campaign.created_by_full_name,
    createdAt: campaign.created_at.toISOString(),
    deletedAt: campaign.deleted_at?.toISOString() ?? null,
  };
}

function isAllowedCampaignRestrictionType(type: string): type is RestrictionType {
  return (ALLOWED_REGISTRATION_FORM_RESTRICTION_TYPES as string[]).includes(type);
}

function validateRestrictions(
  raw: unknown,
): { ok: true; restrictions: ElectionCampaignRestriction[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, restrictions: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'restrictions must be an array' };
  if (raw.length > CAMPAIGN_MAX_RESTRICTIONS) {
    return {
      ok: false,
      error: `at most ${CAMPAIGN_MAX_RESTRICTIONS} restrictions allowed`,
    };
  }

  const seen = new Set<string>();
  const result: ElectionCampaignRestriction[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: 'restriction entries must be objects' };
    }
    const { type, value } = entry as Record<string, unknown>;
    if (typeof type !== 'string' || typeof value !== 'string') {
      return { ok: false, error: 'restriction type and value must be strings' };
    }
    if (!isAllowedCampaignRestrictionType(type)) {
      return {
        ok: false,
        error: `restriction type ${type} not allowed (allowed: ${ALLOWED_REGISTRATION_FORM_RESTRICTION_TYPES.join(', ')})`,
      };
    }
    const trimmed = value.trim();
    if (!trimmed) return { ok: false, error: 'restriction value must not be empty' };
    if (trimmed.length > CAMPAIGN_RESTRICTION_VALUE_MAX_LENGTH) {
      return {
        ok: false,
        error: `restriction value must be at most ${CAMPAIGN_RESTRICTION_VALUE_MAX_LENGTH} characters`,
      };
    }
    const dedupeKey = `${type}|${trimmed}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({ type, value: trimmed });
  }

  return { ok: true, restrictions: result };
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function checkRange(value: number, min: number, max: number, fieldName: string): string | null {
  if (value < min || value > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

export interface ValidatedCreateCampaignBody {
  positionTitle: string;
  electionKind: ElectionKind;
  announcedAt: Date;
  registrationClosesAt: Date;
  signatureCollection: boolean;
  signaturesOpensAt: Date | null;
  signaturesClosesAt: Date | null;
  signatureQuorum: number | null;
  teamSize: number;
  requiresCampaignProgram: boolean;
  votingOpensAt: Date;
  votingClosesAt: Date;
  restrictions: ElectionCampaignRestriction[];
}

function parseTimestamp(
  raw: unknown,
  field: string,
): { ok: true; date: Date } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: `${field} is required` };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime()))
    return { ok: false, error: `${field} must be a valid ISO timestamp` };
  return { ok: true, date: d };
}

export function validateCreateCampaignBody(
  body: unknown,
): { ok: true; data: ValidatedCreateCampaignBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  const raw = body as Partial<CreateElectionCampaignRequest> & Record<string, unknown>;

  const positionTitle = typeof raw.positionTitle === 'string' ? raw.positionTitle.trim() : '';
  if (!positionTitle) return { ok: false, error: 'positionTitle is required' };
  if (positionTitle.length > CAMPAIGN_POSITION_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `positionTitle must be at most ${CAMPAIGN_POSITION_TITLE_MAX_LENGTH} characters`,
    };
  }

  const electionKind = raw.electionKind;
  if (typeof electionKind !== 'string' || !ELECTION_KINDS.includes(electionKind as ElectionKind)) {
    return {
      ok: false,
      error: `electionKind must be one of ${ELECTION_KINDS.join(', ')}`,
    };
  }

  const announcedRes = parseTimestamp(raw.announcedAt, 'announcedAt');
  if (!announcedRes.ok) return announcedRes;
  const announcedAt = announcedRes.date;

  const regClosesRes = parseTimestamp(raw.registrationClosesAt, 'registrationClosesAt');
  if (!regClosesRes.ok) return regClosesRes;
  const registrationClosesAt = regClosesRes.date;

  if (typeof raw.signatureCollection !== 'boolean') {
    return { ok: false, error: 'signatureCollection must be a boolean' };
  }

  let signaturesOpensAt: Date | null = null;
  let signaturesClosesAt: Date | null = null;
  let signatureQuorum: number | null = null;

  if (raw.signatureCollection) {
    const sigOpensRes = parseTimestamp(raw.signaturesOpensAt, 'signaturesOpensAt');
    if (!sigOpensRes.ok) return sigOpensRes;
    const sigClosesRes = parseTimestamp(raw.signaturesClosesAt, 'signaturesClosesAt');
    if (!sigClosesRes.ok) return sigClosesRes;
    signaturesOpensAt = sigOpensRes.date;
    signaturesClosesAt = sigClosesRes.date;

    if (!isInt(raw.signatureQuorum)) {
      return { ok: false, error: 'signatureQuorum is required when signatureCollection=true' };
    }
    const err = checkRange(
      raw.signatureQuorum,
      CAMPAIGN_SIGNATURE_QUORUM_MIN,
      CAMPAIGN_SIGNATURE_QUORUM_MAX,
      'signatureQuorum',
    );
    if (err) return { ok: false, error: err };
    signatureQuorum = raw.signatureQuorum;
  } else {
    if (
      (raw.signaturesOpensAt !== undefined && raw.signaturesOpensAt !== null) ||
      (raw.signaturesClosesAt !== undefined && raw.signaturesClosesAt !== null) ||
      (raw.signatureQuorum !== undefined && raw.signatureQuorum !== null)
    ) {
      return {
        ok: false,
        error: 'signature fields must be omitted when signatureCollection=false',
      };
    }
  }

  let teamSize = 0;
  if (raw.teamSize !== undefined) {
    if (!isInt(raw.teamSize)) return { ok: false, error: 'teamSize must be an integer' };
    const err = checkRange(
      raw.teamSize,
      CAMPAIGN_TEAM_SIZE_MIN,
      CAMPAIGN_TEAM_SIZE_MAX,
      'teamSize',
    );
    if (err) return { ok: false, error: err };
    teamSize = raw.teamSize;
  }

  let requiresCampaignProgram = false;
  if (raw.requiresCampaignProgram !== undefined) {
    if (typeof raw.requiresCampaignProgram !== 'boolean') {
      return { ok: false, error: 'requiresCampaignProgram must be a boolean' };
    }
    requiresCampaignProgram = raw.requiresCampaignProgram;
  }

  const votingOpensRes = parseTimestamp(raw.votingOpensAt, 'votingOpensAt');
  if (!votingOpensRes.ok) return votingOpensRes;
  const votingClosesRes = parseTimestamp(raw.votingClosesAt, 'votingClosesAt');
  if (!votingClosesRes.ok) return votingClosesRes;
  const votingOpensAt = votingOpensRes.date;
  const votingClosesAt = votingClosesRes.date;

  if (votingClosesAt <= votingOpensAt) {
    return { ok: false, error: 'votingClosesAt must be after votingOpensAt' };
  }
  const votingDurationDays = (votingClosesAt.getTime() - votingOpensAt.getTime()) / MS_PER_DAY;
  if (votingDurationDays > CAMPAIGN_VOTING_MAX_DURATION_DAYS) {
    return {
      ok: false,
      error: `voting window must be at most ${CAMPAIGN_VOTING_MAX_DURATION_DAYS} days`,
    };
  }

  // Phase-boundary chain.  Each boundary must be strictly after the previous
  // for non-degenerate phases, except review windows which may collapse to
  // zero duration.
  if (registrationClosesAt <= announcedAt) {
    return { ok: false, error: 'registrationClosesAt must be after announcedAt' };
  }
  if (signaturesOpensAt && signaturesClosesAt) {
    if (signaturesOpensAt < registrationClosesAt) {
      return { ok: false, error: 'signaturesOpensAt must be at or after registrationClosesAt' };
    }
    if (signaturesClosesAt <= signaturesOpensAt) {
      return { ok: false, error: 'signaturesClosesAt must be after signaturesOpensAt' };
    }
    if (votingOpensAt < signaturesClosesAt) {
      return { ok: false, error: 'votingOpensAt must be at or after signaturesClosesAt' };
    }
  } else if (votingOpensAt < registrationClosesAt) {
    return { ok: false, error: 'votingOpensAt must be at or after registrationClosesAt' };
  }

  const totalDurationDays = (votingClosesAt.getTime() - announcedAt.getTime()) / MS_PER_DAY;
  if (totalDurationDays > CAMPAIGN_TOTAL_MAX_DURATION_DAYS) {
    return {
      ok: false,
      error: `campaign must finish within ${CAMPAIGN_TOTAL_MAX_DURATION_DAYS} days of announcement`,
    };
  }

  const restrictionsRes = validateRestrictions(raw.restrictions);
  if (!restrictionsRes.ok) return { ok: false, error: restrictionsRes.error };

  return {
    ok: true,
    data: {
      positionTitle,
      electionKind: electionKind as ElectionKind,
      announcedAt,
      registrationClosesAt,
      signatureCollection: raw.signatureCollection,
      signaturesOpensAt,
      signaturesClosesAt,
      signatureQuorum,
      teamSize,
      requiresCampaignProgram,
      votingOpensAt,
      votingClosesAt,
      restrictions: restrictionsRes.restrictions,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// State machine
// Walks date-driven transitions and creates the per-campaign
// `CandidateRegistrationForm`, signature elections, and final election as
// the campaign reaches each state.
// ────────────────────────────────────────────────────────────────────────────

interface CampaignTickRow {
  id: string;
  state: CampaignState;
  announced_at: Date;
  registration_closes_at: Date;
  signature_collection: boolean;
  signatures_opens_at: Date | null;
  signatures_closes_at: Date | null;
  voting_opens_at: Date;
  voting_closes_at: Date;
}

/**
 * States in which the auto-spawned `CandidateRegistrationForm` must already
 * exist.  Anything from REGISTRATION_OPEN onward (except CANCELLED) needs
 * the form on record so reviewers and historians can see the candidate pool.
 */
const STATES_REQUIRING_REGISTRATION_FORM: CampaignState[] = [
  'REGISTRATION_OPEN',
  'REGISTRATION_REVIEW',
  'SIGNATURES_OPEN',
  'SIGNATURES_REVIEW',
  'VOTING_OPEN',
  'VOTING_CLOSED',
  'COMPLETED',
  'FAILED',
];

/**
 * States in which signature-collection campaigns must have one Election per
 * APPROVED candidate already created.
 */
const STATES_REQUIRING_SIGNATURE_ELECTIONS: CampaignState[] = [
  'SIGNATURES_OPEN',
  'SIGNATURES_REVIEW',
  'VOTING_OPEN',
  'VOTING_CLOSED',
  'COMPLETED',
];

/** States from which the campaign hasn't yet "decided" the registration outcome. */
const PRE_REVIEW_DECISION_STATES: CampaignState[] = [
  'ANNOUNCED',
  'REGISTRATION_OPEN',
  'REGISTRATION_REVIEW',
];

/** States that imply the campaign has progressed past REGISTRATION_REVIEW. */
const POST_REVIEW_PROGRESS_STATES: CampaignState[] = [
  'SIGNATURES_OPEN',
  'SIGNATURES_REVIEW',
  'VOTING_OPEN',
  'VOTING_CLOSED',
  'COMPLETED',
];

/** States from which the campaign hasn't yet "decided" the signature outcome. */
const PRE_VOTING_DECISION_STATES: CampaignState[] = ['SIGNATURES_OPEN', 'SIGNATURES_REVIEW'];

/** States that imply voting has been reached (or passed). */
const VOTING_AND_BEYOND_STATES: CampaignState[] = ['VOTING_OPEN', 'VOTING_CLOSED', 'COMPLETED'];

/** States in which the campaign's final `Election` must already exist. */
const STATES_REQUIRING_FINAL_ELECTION: CampaignState[] = [
  'VOTING_OPEN',
  'VOTING_CLOSED',
  'COMPLETED',
];

/**
 * Compute the state a campaign should be in given current time, based purely
 * on its phase-boundary timestamps plus current state for terminal transitions.
 * Returns null if the current state is correct.
 *
 * VOTING_CLOSED → COMPLETED happens on the next tick once voting has ended,
 * giving the dashboard a brief "voting closed, finalising" view before the
 * campaign moves into its terminal COMPLETED state.
 */
export function expectedStateAt(c: CampaignTickRow, now: Date): CampaignState | null {
  if (c.state === 'CANCELLED' || c.state === 'COMPLETED' || c.state === 'FAILED') {
    return null;
  }

  const hasSignaturePhase =
    c.signature_collection && c.signatures_opens_at !== null && c.signatures_closes_at !== null;

  let target: CampaignState;
  if (now < c.announced_at) {
    target = 'ANNOUNCED';
  } else if (now < c.registration_closes_at) {
    target = 'REGISTRATION_OPEN';
  } else if (hasSignaturePhase && now < c.signatures_opens_at!) {
    target = 'REGISTRATION_REVIEW';
  } else if (hasSignaturePhase && now < c.signatures_closes_at!) {
    target = 'SIGNATURES_OPEN';
  } else if (hasSignaturePhase && now < c.voting_opens_at) {
    target = 'SIGNATURES_REVIEW';
  } else if (!hasSignaturePhase && now < c.voting_opens_at) {
    target = 'REGISTRATION_REVIEW';
  } else if (now < c.voting_closes_at) {
    target = 'VOTING_OPEN';
  } else if (c.state === 'VOTING_CLOSED') {
    // A tick after voting closes graduates the campaign to COMPLETED.
    target = 'COMPLETED';
  } else {
    target = 'VOTING_CLOSED';
  }

  return target === c.state ? null : target;
}

/**
 * Idempotently spawn the `CandidateRegistrationForm` for a campaign that has
 * reached REGISTRATION_OPEN (or any later, non-terminal state).  All work
 * happens inside a single transaction so the form-create + campaign-update
 * either both land or both don't — preventing orphaned forms.
 *
 * Restrictions are copied verbatim from the campaign.  `created_by_full_name`
 * is plaintext (= group name) to match the campaign itself; `safeDecrypt` on
 * the read path falls back to plaintext when decryption fails.
 */
export async function ensureCampaignRegistrationForm(campaignId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const c = await tx.electionCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        group_id: true,
        position_title: true,
        requires_campaign_program: true,
        team_size: true,
        announced_at: true,
        registration_closes_at: true,
        registration_form_id: true,
        deleted_at: true,
        created_by: true,
        created_by_full_name: true,
        restrictions: { select: { type: true, value: true } },
      },
    });
    if (!c || c.deleted_at || c.registration_form_id) return;

    const form = await tx.candidateRegistrationForm.create({
      data: {
        group_id: c.group_id,
        title: `Реєстрація кандидатів — ${c.position_title}`,
        description: null,
        requires_campaign_program: c.requires_campaign_program,
        team_size: c.team_size,
        opens_at: c.announced_at,
        closes_at: c.registration_closes_at,
        created_by: c.created_by,
        created_by_full_name: c.created_by_full_name,
        restrictions: c.restrictions.length
          ? { create: c.restrictions.map((r) => ({ type: r.type, value: r.value })) }
          : undefined,
      },
      select: { id: true },
    });

    await tx.electionCampaign.update({
      where: { id: c.id },
      data: { registration_form_id: form.id },
    });
  });
}

/**
 * Count APPROVED candidate registrations on the given form.  Returns 0 when
 * the form id is null (form not yet spawned) — semantically equivalent for
 * the FAILED-override decision since no candidates can exist without a form.
 */
async function countApprovedCandidates(formId: string | null): Promise<number> {
  if (!formId) return 0;
  return prisma.candidateRegistration.count({
    where: { form_id: formId, status: 'APPROVED' },
  });
}

/**
 * Idempotently spawn one signature-collection `Election` per APPROVED
 * candidate.  Each election is `type=ELECTION`, `anonymous=true`, with a
 * single choice "Підтримую" and `winning_conditions.quorum =
 * campaign.signature_quorum`.  Restrictions are copied verbatim from the
 * campaign so eligibility matches.  Skips candidates that already have a
 * signature election (DB-level uniqueness on `candidate_registration_id`
 * provides a backstop against concurrent ticks).
 *
 * No-op when:
 *  - campaign is CANCELLED / FAILED / soft-deleted
 *  - campaign doesn't use signature collection
 *  - the registration form hasn't been created yet
 *  - there are no APPROVED candidates without an election yet
 */
export async function ensureCampaignSignatureElections(campaignId: string): Promise<void> {
  const campaign = await prisma.electionCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      state: true,
      deleted_at: true,
      position_title: true,
      signature_collection: true,
      signature_quorum: true,
      signatures_opens_at: true,
      signatures_closes_at: true,
      registration_form_id: true,
      created_by: true,
      created_by_full_name: true,
      restrictions: { select: { type: true, value: true } },
    },
  });
  if (!campaign || campaign.deleted_at) return;
  if (campaign.state === 'CANCELLED' || campaign.state === 'FAILED') return;
  if (!campaign.signature_collection) return;
  if (
    !campaign.registration_form_id ||
    campaign.signature_quorum === null ||
    campaign.signatures_opens_at === null ||
    campaign.signatures_closes_at === null
  ) {
    return;
  }

  const approved = await prisma.candidateRegistration.findMany({
    where: { form_id: campaign.registration_form_id, status: 'APPROVED' },
    select: {
      id: true,
      full_name: true,
      signature_election: { select: { id: true } },
    },
  });

  const missing = approved.filter((reg) => reg.signature_election === null);
  if (missing.length === 0) return;

  const winningConditions: Prisma.InputJsonObject = {
    hasMostVotes: false,
    reachesPercentage: null,
    reachesVotes: null,
    quorum: campaign.signature_quorum,
  };
  const publicViewing = campaign.restrictions.length === 0;

  let createdAny = false;
  for (const reg of missing) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction so concurrent ticks can't
        // double-spawn (the unique index on candidate_registration_id is the
        // hard backstop, but we'd rather skip than catch the constraint).
        const existing = await tx.election.findUnique({
          where: { candidate_registration_id: reg.id },
          select: { id: true },
        });
        if (existing) return;

        const { publicKey, privateKey } = generateElectionKeyPair();
        const candidateName = safeDecrypt(reg.full_name);
        const now = new Date();

        await tx.election.create({
          data: {
            type: 'ELECTION',
            title: `Збір підписів — ${candidateName}`,
            description: `Кандидат на посаду «${campaign.position_title}». Кворум підписів: ${campaign.signature_quorum}.`,
            created_by: campaign.created_by,
            created_by_full_name: campaign.created_by_full_name,
            approved: true,
            approved_by_id: campaign.created_by,
            approved_by_full_name: campaign.created_by_full_name,
            approved_at: now,
            opens_at: campaign.signatures_opens_at!,
            closes_at: campaign.signatures_closes_at!,
            min_choices: 1,
            max_choices: 1,
            public_key: publicKey,
            private_key: encryptField(privateKey),
            winning_conditions: winningConditions,
            shuffle_choices: false,
            public_viewing: publicViewing,
            anonymous: true,
            campaign_id: campaign.id,
            candidate_registration_id: reg.id,
            choices: { create: [{ choice: 'Підтримую', position: 0 }] },
            restrictions: campaign.restrictions.length
              ? {
                  create: campaign.restrictions.map((r) => ({ type: r.type, value: r.value })),
                }
              : undefined,
          },
          select: { id: true },
        });
        createdAny = true;
      });
    } catch (err) {
      // Concurrent tick may have inserted between our pre-check and create.
      // Swallow the unique-constraint race; other errors propagate.
      const code = (err as { code?: string })?.code;
      if (code !== 'P2002') throw err;
    }
  }

  if (createdAny) {
    await invalidateElections();
  }
}

/**
 * For a signature-collection campaign, return the list of candidate
 * registrations whose signature election ballot count meets or exceeds the
 * configured quorum.  Non-signature campaigns short-circuit to the APPROVED
 * list (no signature gate to pass).
 */
async function listCandidatesPassingSignatureGate(campaign: {
  id: string;
  signature_collection: boolean;
  signature_quorum: number | null;
  registration_form_id: string | null;
}): Promise<Array<{ id: string; full_name: string }>> {
  if (!campaign.registration_form_id) return [];
  const approved = await prisma.candidateRegistration.findMany({
    where: { form_id: campaign.registration_form_id, status: 'APPROVED' },
    select: {
      id: true,
      full_name: true,
      signature_election: {
        select: { id: true, _count: { select: { ballots: true } } },
      },
    },
  });

  if (!campaign.signature_collection) {
    return approved.map((r) => ({ id: r.id, full_name: r.full_name }));
  }
  const quorum = campaign.signature_quorum ?? 0;
  return approved
    .filter((r) => (r.signature_election?._count.ballots ?? 0) >= quorum)
    .map((r) => ({ id: r.id, full_name: r.full_name }));
}

/**
 * Idempotently spawn the campaign's final `Election` once we hit VOTING_OPEN
 * (or any later non-terminal state).  The election has one choice per
 * qualifying candidate (APPROVED for non-signature campaigns; APPROVED +
 * signature quorum reached for signature ones).  Restrictions, dates and
 * audience are copied from the campaign.
 *
 * No-op when:
 *  - campaign is CANCELLED / FAILED / soft-deleted
 *  - the campaign already has a final_election_id
 *  - there are no qualifying candidates (caller should have flipped FAILED)
 */
export async function ensureCampaignFinalElection(campaignId: string): Promise<void> {
  const campaign = await prisma.electionCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      state: true,
      deleted_at: true,
      position_title: true,
      election_kind: true,
      signature_collection: true,
      signature_quorum: true,
      registration_form_id: true,
      final_election_id: true,
      voting_opens_at: true,
      voting_closes_at: true,
      created_by: true,
      created_by_full_name: true,
      restrictions: { select: { type: true, value: true } },
    },
  });
  if (!campaign || campaign.deleted_at) return;
  if (campaign.state === 'CANCELLED' || campaign.state === 'FAILED') return;
  if (campaign.final_election_id) return;

  const qualifying = await listCandidatesPassingSignatureGate(campaign);
  if (qualifying.length === 0) return;

  const winningConditions: Prisma.InputJsonObject = {
    hasMostVotes: true,
    reachesPercentage: null,
    reachesVotes: null,
    quorum: null,
  };
  const publicViewing = campaign.restrictions.length === 0;

  await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction to guard against concurrent ticks
    // racing the campaign through VOTING_OPEN twice.
    const fresh = await tx.electionCampaign.findUnique({
      where: { id: campaign.id },
      select: { final_election_id: true, deleted_at: true },
    });
    if (!fresh || fresh.deleted_at || fresh.final_election_id) return;

    const { publicKey, privateKey } = generateElectionKeyPair();
    const now = new Date();

    const election = await tx.election.create({
      data: {
        type: 'ELECTION',
        title: `Голосування — ${campaign.position_title}`,
        description: `Виборча кампанія: ${campaign.position_title}.`,
        created_by: campaign.created_by,
        created_by_full_name: campaign.created_by_full_name,
        approved: true,
        approved_by_id: campaign.created_by,
        approved_by_full_name: campaign.created_by_full_name,
        approved_at: now,
        opens_at: campaign.voting_opens_at,
        closes_at: campaign.voting_closes_at,
        min_choices: 1,
        max_choices: 1,
        public_key: publicKey,
        private_key: encryptField(privateKey),
        winning_conditions: winningConditions,
        shuffle_choices: true,
        public_viewing: publicViewing,
        anonymous: true,
        campaign_id: campaign.id,
        candidate_registration_id: null,
        choices: {
          create: qualifying.map((reg, i) => ({
            choice: safeDecrypt(reg.full_name),
            position: i,
            candidate_registration_id: reg.id,
          })),
        },
        restrictions: campaign.restrictions.length
          ? { create: campaign.restrictions.map((r) => ({ type: r.type, value: r.value })) }
          : undefined,
      },
      select: { id: true },
    });

    await tx.electionCampaign.update({
      where: { id: campaign.id },
      data: { final_election_id: election.id },
    });
  });

  await invalidateElections();
}

/**
 * Cron tick: advance every non-terminal campaign to the state implied by the
 * current clock, then run any side-effects required by the new state.
 *
 *  - Spawn `CandidateRegistrationForm` once registration begins.
 *  - Spawn per-candidate signature `Election`s when entering the signature
 *    phase, OR override to FAILED if no candidates were APPROVED by the time
 *    registration review closes.
 *  - Spawn the final `Election` when entering VOTING_OPEN, override to FAILED
 *    if no candidates passed the signature quorum, and graduate
 *    VOTING_CLOSED → COMPLETED on the next tick after voting closes.
 *
 * Returns the number of state updates that landed.
 */
export async function transitionCampaignsByDate(now: Date = new Date()): Promise<number> {
  const candidates = await prisma.electionCampaign.findMany({
    where: {
      deleted_at: null,
      state: { notIn: ['CANCELLED', 'COMPLETED', 'FAILED'] },
    },
    select: {
      id: true,
      state: true,
      announced_at: true,
      registration_closes_at: true,
      signature_collection: true,
      signature_quorum: true,
      signatures_opens_at: true,
      signatures_closes_at: true,
      voting_opens_at: true,
      voting_closes_at: true,
      registration_form_id: true,
      final_election_id: true,
    },
  });

  let changed = 0;
  for (const row of candidates) {
    let next = expectedStateAt(row, now);

    // 0 APPROVED at REGISTRATION_REVIEW boundary → FAILED.
    if (
      next &&
      PRE_REVIEW_DECISION_STATES.includes(row.state) &&
      POST_REVIEW_PROGRESS_STATES.includes(next)
    ) {
      const approvedCount = await countApprovedCandidates(row.registration_form_id);
      if (approvedCount === 0) {
        next = 'FAILED';
      }
    }

    // 0 candidates passed signature quorum at SIGNATURES_REVIEW boundary →
    // FAILED.  Only meaningful for signature campaigns; non-signature ones
    // already had their FAILED check at REGISTRATION_REVIEW above.
    if (
      next &&
      row.signature_collection &&
      PRE_VOTING_DECISION_STATES.includes(row.state) &&
      VOTING_AND_BEYOND_STATES.includes(next)
    ) {
      const passing = await listCandidatesPassingSignatureGate(row);
      if (passing.length === 0) {
        next = 'FAILED';
      }
    }

    if (next) {
      await prisma.electionCampaign.update({
        where: { id: row.id },
        data: { state: next },
      });
      changed += 1;
    }
    const effectiveState = next ?? row.state;
    if (!row.registration_form_id && STATES_REQUIRING_REGISTRATION_FORM.includes(effectiveState)) {
      await ensureCampaignRegistrationForm(row.id);
    }
    if (row.signature_collection && STATES_REQUIRING_SIGNATURE_ELECTIONS.includes(effectiveState)) {
      await ensureCampaignSignatureElections(row.id);
    }
    if (!row.final_election_id && STATES_REQUIRING_FINAL_ELECTION.includes(effectiveState)) {
      await ensureCampaignFinalElection(row.id);
    }
  }
  return changed;
}

/**
 * Helpers for the candidate registration forms API:
 *  - input validation shared between POST/PATCH endpoints
 *  - canonical Prisma `include` shape and DB → client transformer
 */

import type { Prisma } from '@prisma/client';

import {
  ALLOWED_REGISTRATION_FORM_RESTRICTION_TYPES,
  isAllowedRegistrationFormRestrictionType,
} from '@/lib/candidate-registration';
import {
  REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH,
  REGISTRATION_FORM_MAX_DURATION_DAYS,
  REGISTRATION_FORM_MAX_RESTRICTIONS,
  REGISTRATION_FORM_MAX_TEAM_SIZE,
  REGISTRATION_FORM_RESTRICTION_VALUE_MAX_LENGTH,
  REGISTRATION_FORM_TITLE_MAX_LENGTH,
} from '@/lib/constants';
import type {
  CandidateRegistrationForm,
  CandidateRegistrationFormRestriction,
} from '@/types/candidate-registration';

export const FORM_INCLUDE = {
  restrictions: { select: { type: true, value: true } },
  group: { select: { name: true, type: true, deleted_at: true } },
} satisfies Prisma.CandidateRegistrationFormInclude;

export type FormWithRestrictions = Prisma.CandidateRegistrationFormGetPayload<{
  include: typeof FORM_INCLUDE;
}>;

export function shapeForm(form: FormWithRestrictions): CandidateRegistrationForm {
  return {
    id: form.id,
    groupId: form.group_id,
    groupName: form.group.name,
    title: form.title,
    description: form.description ?? null,
    requiresCampaignProgram: form.requires_campaign_program,
    teamSize: form.team_size,
    opensAt: form.opens_at.toISOString(),
    closesAt: form.closes_at.toISOString(),
    restrictions: form.restrictions.map((r) => ({ type: r.type, value: r.value })),
    createdBy: form.created_by,
    createdByFullName: form.created_by_full_name,
    createdAt: form.created_at.toISOString(),
    updatedAt: form.updated_at.toISOString(),
  };
}

export function validateRestrictions(
  raw: unknown,
):
  | { ok: true; restrictions: CandidateRegistrationFormRestriction[] }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, restrictions: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'restrictions must be an array' };
  if (raw.length > REGISTRATION_FORM_MAX_RESTRICTIONS) {
    return {
      ok: false,
      error: `at most ${REGISTRATION_FORM_MAX_RESTRICTIONS} restrictions allowed`,
    };
  }

  const seen = new Set<string>();
  const result: CandidateRegistrationFormRestriction[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: 'restriction entries must be objects' };
    }
    const { type, value } = entry as Record<string, unknown>;
    if (typeof type !== 'string' || typeof value !== 'string') {
      return { ok: false, error: 'restriction type and value must be strings' };
    }
    if (!isAllowedRegistrationFormRestrictionType(type)) {
      return {
        ok: false,
        error: `restriction type ${type} not allowed (allowed: ${ALLOWED_REGISTRATION_FORM_RESTRICTION_TYPES.join(', ')})`,
      };
    }
    const trimmed = value.trim();
    if (!trimmed) return { ok: false, error: 'restriction value must not be empty' };
    if (trimmed.length > REGISTRATION_FORM_RESTRICTION_VALUE_MAX_LENGTH) {
      return {
        ok: false,
        error: `restriction value must be at most ${REGISTRATION_FORM_RESTRICTION_VALUE_MAX_LENGTH} characters`,
      };
    }

    const dedupeKey = `${type}|${trimmed}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({ type, value: trimmed });
  }

  return { ok: true, restrictions: result };
}

export interface ValidatedFormBody {
  title: string;
  description: string | null;
  requiresCampaignProgram: boolean;
  teamSize: number;
  opensAt: Date;
  closesAt: Date;
  restrictions: CandidateRegistrationFormRestriction[];
}

/**
 * Validates a fully-specified create body or a complete update payload.  PATCH
 * callers should send the full intended state — partial diffs are not
 * supported (replace-all semantics).
 */
export function validateFormBody(
  body: unknown,
): { ok: true; data: ValidatedFormBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  const { title, description, requiresCampaignProgram, teamSize, opensAt, closesAt, restrictions } =
    body as Record<string, unknown>;

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) return { ok: false, error: 'title is required' };
  if (trimmedTitle.length > REGISTRATION_FORM_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `title must be at most ${REGISTRATION_FORM_TITLE_MAX_LENGTH} characters`,
    };
  }

  let trimmedDescription: string | null = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return { ok: false, error: 'description must be a string' };
    }
    const t = description.trim();
    if (t) {
      if (t.length > REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH) {
        return {
          ok: false,
          error: `description must be at most ${REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH} characters`,
        };
      }
      trimmedDescription = t;
    }
  }

  let normalisedRequiresCampaign = false;
  if (requiresCampaignProgram !== undefined) {
    if (typeof requiresCampaignProgram !== 'boolean') {
      return { ok: false, error: 'requiresCampaignProgram must be a boolean' };
    }
    normalisedRequiresCampaign = requiresCampaignProgram;
  }

  let normalisedTeamSize = 0;
  if (teamSize !== undefined) {
    if (typeof teamSize !== 'number' || !Number.isInteger(teamSize)) {
      return { ok: false, error: 'teamSize must be an integer' };
    }
    if (teamSize < 0 || teamSize > REGISTRATION_FORM_MAX_TEAM_SIZE) {
      return {
        ok: false,
        error: `teamSize must be between 0 and ${REGISTRATION_FORM_MAX_TEAM_SIZE}`,
      };
    }
    normalisedTeamSize = teamSize;
  }

  if (typeof opensAt !== 'string' || typeof closesAt !== 'string') {
    return { ok: false, error: 'opensAt and closesAt are required' };
  }
  const opens = new Date(opensAt);
  const closes = new Date(closesAt);
  if (isNaN(opens.getTime()) || isNaN(closes.getTime())) {
    return { ok: false, error: 'opensAt and closesAt must be valid ISO timestamps' };
  }
  if (closes <= opens) {
    return { ok: false, error: 'closesAt must be after opensAt' };
  }
  const durationDays = (closes.getTime() - opens.getTime()) / (1000 * 60 * 60 * 24);
  if (durationDays > REGISTRATION_FORM_MAX_DURATION_DAYS) {
    return {
      ok: false,
      error: `form duration must be at most ${REGISTRATION_FORM_MAX_DURATION_DAYS} days`,
    };
  }

  const restrictionsRes = validateRestrictions(restrictions);
  if (!restrictionsRes.ok) return { ok: false, error: restrictionsRes.error };

  return {
    ok: true,
    data: {
      title: trimmedTitle,
      description: trimmedDescription,
      requiresCampaignProgram: normalisedRequiresCampaign,
      teamSize: normalisedTeamSize,
      opensAt: opens,
      closesAt: closes,
      restrictions: restrictionsRes.restrictions,
    },
  };
}

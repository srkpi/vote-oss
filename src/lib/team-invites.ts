/**
 * Team invite token helpers.
 *
 * Per registration there are exactly `team_size` slots numbered 1..N.  Each
 * slot has a history of tokens; at any moment the slot's state is derived
 * from the *most recent* token (or absence of one).
 *
 * State machine:
 *  - empty     — no token has ever been issued for this slot
 *  - pending   — there's a non-revoked, non-expired, non-used token
 *  - rejected  — most recent token was used with response=REJECTED
 *  - expired   — most recent token was revoked or its expires_at is past
 *  - accepted  — most recent token was used with response=ACCEPTED  (terminal)
 *
 * The candidate may regenerate a token for any non-`accepted` slot.  Once a
 * slot is `accepted`, it is locked.
 */

import type { TeamMemberInviteToken } from '@prisma/client';

import type { TeamSlot, TeamSlotState } from '@/types/candidate-registration';

/**
 * Compute the state of a slot from its most recent token (or null when no
 * token has ever been issued).
 */
function classifyToken(t: TeamMemberInviteToken | null, now: Date): TeamSlotState {
  if (!t) return 'empty';
  if (t.used_at) {
    return t.response === 'ACCEPTED' ? 'accepted' : 'rejected';
  }
  if (t.revoked_at) return 'expired';
  if (t.expires_at <= now) return 'expired';
  return 'pending';
}

/**
 * Build the `TeamSlot[]` view served to the candidate, given all tokens for
 * a registration.  Slots without any token are returned as `empty`.
 */
export function buildSlots(
  teamSize: number,
  tokens: TeamMemberInviteToken[],
  now: Date = new Date(),
): TeamSlot[] {
  // Group by slot, keep most recent only
  const latestBySlot = new Map<number, TeamMemberInviteToken>();
  for (const t of tokens) {
    const prev = latestBySlot.get(t.slot);
    if (!prev || t.created_at > prev.created_at) latestBySlot.set(t.slot, t);
  }

  const slots: TeamSlot[] = [];
  for (let slot = 1; slot <= teamSize; slot += 1) {
    const t = latestBySlot.get(slot) ?? null;
    const state = classifyToken(t, now);
    slots.push({
      slot,
      state,
      member:
        t && t.used_at && t.used_by_user_id
          ? { userId: t.used_by_user_id, fullName: t.used_by_full_name ?? '' }
          : null,
      expiresAt: state === 'pending' && t ? t.expires_at.toISOString() : null,
      resolvedAt: t?.used_at?.toISOString() ?? t?.revoked_at?.toISOString() ?? null,
    });
  }
  return slots;
}

/**
 * Returns true when every slot is `accepted` — i.e. the registration is
 * ready to be promoted from AWAITING_TEAM to PENDING_REVIEW.
 */
export function allSlotsAccepted(slots: TeamSlot[]): boolean {
  return slots.length > 0 && slots.every((s) => s.state === 'accepted');
}

/**
 * Pure transformation helpers that convert cached election metadata into the
 * client-facing `Election` shape.  Extracted from `/api/elections/route.ts` so
 * other endpoints (e.g. group detail) can reuse the same conversion without
 * duplicating tally / restriction / shuffle logic.
 */

import { decryptField } from '@/lib/encryption';
import {
  adminCanAccessElection,
  adminCanDeleteElection,
  adminCanRestoreElection,
  checkRestrictionsWithBypass,
} from '@/lib/restrictions';
import { shuffleChoicesForUser } from '@/lib/utils/shuffle-choices';
import { computeWinners } from '@/lib/winning-conditions';
import type {
  CachedElection,
  CachedElectionChoice,
  Election,
  ElectionStatus,
  ElectionType,
  ElectionVoteStatus,
  TallyResult,
  WinningConditions,
} from '@/types/election';

export type AdminContext = {
  user_id: string;
  restricted_to_faculty: boolean;
  faculty: string;
  manage_petitions: boolean;
};

export function computeStatus(opensAt: string | Date, closesAt: string | Date): ElectionStatus {
  const now = Date.now();
  const open = typeof opensAt === 'string' ? new Date(opensAt).getTime() : opensAt.getTime();
  const close = typeof closesAt === 'string' ? new Date(closesAt).getTime() : closesAt.getTime();

  if (now < open) return 'upcoming';
  if (now <= close) return 'open';
  return 'closed';
}

/**
 * Build tally results from cached choices using winning conditions.
 * Returns null if any voteCount is still null (tallies not yet computed).
 */
export function buildTallyResults(
  choices: CachedElectionChoice[],
  ballotCount: number,
  conditions: WinningConditions,
): TallyResult[] | null {
  if (choices.some((c) => c.voteCount === null)) return null;

  const tally: Record<string, number> = {};
  for (const c of choices) tally[c.id] = c.voteCount!;

  const winners = computeWinners(tally, ballotCount, conditions);

  return choices.map((c) => ({
    choiceId: c.id,
    choice: c.choice,
    position: c.position,
    votes: c.voteCount!,
    winner: winners[c.id] ?? false,
  }));
}

/**
 * Decrypt a stored ciphertext field, falling back to the raw value if the
 * input doesn't look encrypted (protects against stale rows predating the
 * encryption backfill).
 */
export function safeDecrypt(value: string): string {
  try {
    return decryptField(value);
  } catch {
    return value;
  }
}

export interface ToClientElectionsUser {
  sub: string;
  faculty: string;
  group: string;
  speciality?: string;
  studyYear?: number;
  studyForm?: string;
  isAdmin?: boolean;
  restrictedToFaculty?: boolean;
  managePetitions?: boolean;
}

/**
 * Filter + transform cached elections into the client-facing shape.
 *
 * - `typeFilter` = 'ELECTION' | 'PETITION' restricts to that kind.
 *   Pass `null` (or omit) to allow both.
 * - Regular users see only elections they're eligible for OR where
 *   `publicViewing=true`.
 * - Admins see everything within their faculty scope (or everything if
 *   unrestricted).
 */
export function toClientElections(
  cached: CachedElection[],
  user: ToClientElectionsUser,
  votedSet: Set<string>,
  groupMemberships: string[],
  typeFilter: ElectionType | null,
  adminRecord?: AdminContext,
  adminGraph?: Map<string, string | null>,
): Election[] {
  const isAdmin = user.isAdmin ?? false;
  const isAdminRestricted = user.restrictedToFaculty ?? true;
  const isPetitionManager = isAdmin && (user.managePetitions ?? false);

  return cached
    .filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;

      const isDeleted = !!e.deletedAt;
      if (!isAdmin && isDeleted) return false;

      // Petitions: unapproved petitions are only visible to admins with
      // manage_petitions.  Approved petitions follow normal access rules (they
      // have no restrictions, so anyone can see them).
      if (e.type === 'PETITION' && !e.approved) {
        return isPetitionManager;
      }

      if (isAdmin && !isAdminRestricted) return true;
      if (isAdmin && isAdminRestricted) {
        return adminCanAccessElection(user.faculty, e.restrictions);
      }
      // Regular users: only show elections they're eligible for (OR publicViewing=true)
      // GROUP_MEMBERSHIP is now checked with actual memberships from cache.
      return (
        checkRestrictionsWithBypass(e.restrictions, user, null, groupMemberships) || e.publicViewing
      );
    })
    .map((e) => {
      const isClosed = Date.now() > new Date(e.closesAt).getTime();
      const status = computeStatus(e.opensAt, e.closesAt);
      const isDeleted = !!e.deletedAt;

      const tallyResults = isClosed
        ? buildTallyResults(e.choices, e.ballotCount, e.winningConditions)
        : null;
      const tallyMap = new Map(tallyResults?.map((r) => [r.choiceId, r]));

      // Build choices with tally data, then apply shuffle if enabled
      let choices = e.choices.map((c) => {
        const base = { id: c.id, choice: c.choice, position: c.position };
        if (tallyResults) {
          const r = tallyMap.get(c.id);
          return { ...base, votes: r?.votes ?? 0, winner: r?.winner ?? false };
        }
        return base;
      });

      if (e.shuffleChoices) {
        choices = shuffleChoicesForUser(choices, user.sub, e.id);
      }

      // ── voteStatus (regular users only) ──────────────────────────────────
      let voteStatus: ElectionVoteStatus;
      if (votedSet.has(e.id)) {
        voteStatus = 'voted';
      } else {
        const canVote = checkRestrictionsWithBypass(e.restrictions, user, null, groupMemberships);
        voteStatus = canVote ? 'can_vote' : 'cannot_vote';
      }

      const base: Election = {
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        createdAt: e.createdAt,
        opensAt: e.opensAt,
        closesAt: e.closesAt,
        status,
        restrictions: e.restrictions,
        winningConditions: e.winningConditions,
        shuffleChoices: e.shuffleChoices,
        publicViewing: e.publicViewing,
        anonymous: e.anonymous ?? true,
        minChoices: e.minChoices,
        maxChoices: e.maxChoices,
        createdBy: { userId: e.createdBy, fullName: e.createdByFullName },
        approved: e.approved,
        approvedBy:
          e.approvedById && e.approvedByFullName
            ? { userId: e.approvedById, fullName: e.approvedByFullName }
            : null,
        approvedAt: e.approvedAt,
        choices,
        ballotCount: e.ballotCount,
        voteStatus,
      };

      if (isAdmin && adminRecord && adminGraph) {
        let canDelete: boolean;
        let canRestore: boolean;
        if (e.type === 'PETITION') {
          canDelete = !isDeleted && adminRecord.manage_petitions;
          canRestore = isDeleted && adminRecord.manage_petitions;
        } else {
          canDelete =
            !isDeleted &&
            adminCanDeleteElection(
              adminRecord,
              { restrictions: e.restrictions, created_by: e.createdBy },
              adminGraph,
            );
          canRestore =
            isDeleted &&
            adminCanRestoreElection(
              adminRecord,
              { restrictions: e.restrictions, deletedByUserId: e.deletedByUserId },
              adminGraph,
            );
        }
        return {
          ...base,
          deletedAt: e.deletedAt,
          deletedBy: e.deletedByUserId
            ? { userId: e.deletedByUserId, fullName: e.deletedByName ?? '' }
            : null,
          canDelete,
          canRestore,
        };
      }

      return base;
    });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import {
  getCachedElections,
  getCachedUserVotedElections,
  overlayLiveBallotCounts,
  setCachedUserVotedElections,
} from '@/lib/cache';
import {
  GROUP_NAME_MAX_LENGTH,
  GROUP_REQUISITES_ADDRESS_MAX_LENGTH,
  GROUP_REQUISITES_CONTACT_MAX_LENGTH,
  GROUP_REQUISITES_EMAIL_MAX_LENGTH,
  GROUP_REQUISITES_FULL_NAME_MAX_LENGTH,
} from '@/lib/constants';
import {
  type AdminContext,
  computeStatus,
  safeDecrypt,
  toClientElections,
} from '@/lib/elections-view';
import { Errors } from '@/lib/errors';
import { isAllowedImageMime, shapeFileSummary } from '@/lib/files';
import { buildAdminGraph } from '@/lib/graph';
import {
  getUserGroupMemberships,
  GroupForbiddenError,
  GroupNotFoundError,
  invalidateGroupMembershipsForUsers,
  invalidateUserOwnedGroups,
  invalidateVKSUGroupIds,
} from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';
import { parseWinningConditions } from '@/lib/winning-conditions';
import type { VerifiedPayload } from '@/types/auth';
import type {
  CachedElection,
  CachedElectionChoice,
  Election,
  ElectionType,
  RestrictionType,
} from '@/types/election';

const MEMBER_SELECT = {
  id: true,
  user_id: true,
  display_name: true,
  role: true,
  joined_at: true,
  deleted_at: true,
} as const;

const INVITE_LINK_SELECT = {
  id: true,
  label: true,
  max_usage: true,
  current_usage: true,
  expires_at: true,
  created_by: true,
  created_at: true,
  deleted_at: true,
  deleted_by: true,
  usages: {
    select: { id: true, user_id: true, used_at: true },
    orderBy: { used_at: 'desc' as const },
  },
} as const;

/**
 * Fallback DB query used when the elections cache is cold — fetches only the
 * elections restricted to this group and shapes them into the CachedElection
 * structure expected by toClientElections.  Avoids duplicating the full
 * cache-fill in /api/elections, which reads every election in the DB.
 */
async function fetchGroupElectionsFromDb(groupId: string): Promise<CachedElection[]> {
  const rows = await prisma.election.findMany({
    where: {
      deleted_at: null,
      restrictions: {
        some: { type: 'GROUP_MEMBERSHIP', value: groupId },
      },
    },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      created_at: true,
      opens_at: true,
      closes_at: true,
      min_choices: true,
      max_choices: true,
      created_by: true,
      created_by_full_name: true,
      approved: true,
      approved_by_id: true,
      approved_by_full_name: true,
      approved_at: true,
      restrictions: { select: { type: true, value: true } },
      public_key: true,
      private_key: true,
      winning_conditions: true,
      shuffle_choices: true,
      public_viewing: true,
      anonymous: true,
      deleter: { select: { full_name: true } },
      choices: {
        select: { id: true, choice: true, position: true, vote_count: true },
        orderBy: { position: 'asc' },
      },
      _count: { select: { ballots: true } },
      deleted_at: true,
      deleted_by: true,
    },
    orderBy: { opens_at: 'desc' },
  });

  return rows.map((e) => ({
    id: e.id,
    type: e.type as ElectionType,
    title: e.title,
    description: e.description ?? null,
    createdAt: e.created_at.toISOString(),
    opensAt: e.opens_at.toISOString(),
    closesAt: e.closes_at.toISOString(),
    minChoices: e.min_choices,
    maxChoices: e.max_choices,
    restrictions: e.restrictions as { type: RestrictionType; value: string }[],
    publicKey: e.public_key,
    privateKey: e.private_key,
    winningConditions: parseWinningConditions(e.winning_conditions),
    shuffleChoices: e.shuffle_choices,
    publicViewing: e.public_viewing,
    anonymous: e.anonymous,
    createdByFullName: safeDecrypt(e.created_by_full_name),
    approved: e.approved,
    approvedById: e.approved_by_id,
    approvedByFullName: e.approved_by_full_name ? safeDecrypt(e.approved_by_full_name) : null,
    approvedAt: e.approved_at?.toISOString() ?? null,
    choices: e.choices.map((c) => ({
      id: c.id,
      choice: c.choice,
      position: c.position,
      voteCount: c.vote_count ?? null,
    })) as CachedElectionChoice[],
    ballotCount: e._count.ballots,
    createdBy: e.created_by,
    deletedAt: e.deleted_at?.toISOString() ?? null,
    deletedByUserId: e.deleted_by,
    deletedByName: e.deleter?.full_name ?? null,
  }));
}

/**
 * Load the elections restricted to this group, transformed into the shape
 * the client consumes.  Non-members only receive publicly-viewable elections.
 */
async function fetchGroupElections(
  groupId: string,
  user: VerifiedPayload,
  isMember: boolean,
  isAdminWithManageGroups: boolean,
): Promise<{ elections: Election[]; hasAnyPublic: boolean }> {
  const cached = await getCachedElections();

  let groupElections: CachedElection[];
  if (cached) {
    const withLiveCounts = await overlayLiveBallotCounts(cached);
    groupElections = withLiveCounts.filter(
      (e) =>
        !e.deletedAt &&
        e.restrictions.some((r) => r.type === 'GROUP_MEMBERSHIP' && r.value === groupId),
    );
  } else {
    // Cache cold — scoped DB query so public-viewing access doesn't rely on
    // the /api/elections endpoint having been hit first.  Live ballot counts
    // aren't overlaid here; the counts from the DB _count are fresh enough.
    groupElections = await fetchGroupElectionsFromDb(groupId);
  }

  const hasAnyPublic = groupElections.some((e) => e.publicViewing);

  // Resolve admin context (only meaningful when caller is admin).
  const isAdmin = user.isAdmin ?? false;
  let adminRecord: AdminContext | undefined;
  let adminGraph: Map<string, string | null> | undefined;
  if (isAdmin) {
    const dbAdmin = await prisma.admin.findUnique({
      where: { user_id: user.sub, deleted_at: null },
    });
    if (dbAdmin) {
      adminRecord = {
        user_id: dbAdmin.user_id,
        restricted_to_faculty: dbAdmin.restricted_to_faculty,
        faculty: dbAdmin.faculty,
        manage_petitions: dbAdmin.manage_petitions,
      };
      adminGraph = await buildAdminGraph();
    }
  }

  // Voted set (open elections only — same contract as /api/elections).
  const openElectionIds = groupElections
    .filter((e) => computeStatus(e.opensAt, e.closesAt) === 'open')
    .map((e) => e.id);

  const [cachedVoted, memberships] = await Promise.all([
    getCachedUserVotedElections(user.sub),
    getUserGroupMemberships(user.sub),
  ]);

  let votedSet: Set<string>;
  if (cachedVoted !== null) {
    votedSet = cachedVoted;
  } else if (openElectionIds.length > 0) {
    const issuedTokens = await prisma.issuedToken.findMany({
      where: { user_id: user.sub, election_id: { in: openElectionIds } },
      select: { election_id: true },
    });
    votedSet = new Set(issuedTokens.map((t) => t.election_id));
    setCachedUserVotedElections(user.sub, [...votedSet]).catch(() => {
      /* non-fatal */
    });
  } else {
    votedSet = new Set();
  }

  let elections = toClientElections(
    groupElections,
    {
      sub: user.sub,
      faculty: user.faculty,
      group: user.group,
      speciality: user.speciality,
      studyYear: user.studyYear,
      studyForm: user.studyForm,
      isAdmin,
      restrictedToFaculty: user.restrictedToFaculty,
      managePetitions: user.managePetitions,
    },
    votedSet,
    memberships,
    null,
    adminRecord,
    adminGraph,
  );

  // Non-members (and non-manage-groups admins) should only ever see the
  // publicly-viewable elections targeting this group.
  if (!isMember && !isAdminWithManageGroups) {
    elections = elections.filter((e) => e.publicViewing);
  }

  return { elections, hasAnyPublic };
}

async function fetchGroupDetail(groupId: string, user: VerifiedPayload) {
  const isAdminWithManageGroups = (user.isAdmin ?? false) && (user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      type: true,
      owner_id: true,
      created_by: true,
      created_at: true,
      updated_at: true,
      deleted_at: true,
      full_name: true,
      address: true,
      email: true,
      contact: true,
      logo_file: true,
      members: {
        where: { deleted_at: null },
        select: MEMBER_SELECT,
        orderBy: [{ joined_at: 'asc' }],
      },
      invite_links: {
        select: {
          ...INVITE_LINK_SELECT,
          group_id: true,
        },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: {
          members: { where: { deleted_at: null } },
          protocols: { where: { deleted_at: null } },
        },
      },
    },
  });

  if (!group) throw new GroupNotFoundError();

  const isOwner = group.owner_id === user.sub;
  const isMember = group.members.some((m) => m.user_id === user.sub);
  const canManage = isOwner || isAdminWithManageGroups;
  const hasAnyProtocol = group._count.protocols > 0;

  // Fetch elections restricted to this group.  Non-members fall back on the
  // presence of ≥1 publicly-viewable election or ≥1 protocol to decide whether
  // they may see the group at all.
  const { elections, hasAnyPublic } = await fetchGroupElections(
    groupId,
    user,
    isMember,
    isAdminWithManageGroups,
  );

  if (!isMember && !isAdminWithManageGroups && !hasAnyPublic && !hasAnyProtocol) {
    throw new GroupForbiddenError('You are not a member of this group');
  }

  return {
    id: group.id,
    name: group.name,
    type: group.type,
    ownerId: group.owner_id,
    createdBy: group.created_by,
    createdAt: group.created_at.toISOString(),
    updatedAt: group.updated_at.toISOString(),
    memberCount: group._count.members,
    isOwner,
    isMember,
    deletedAt: group.deleted_at?.toISOString() ?? null,
    requisites: {
      fullName: group.full_name,
      address: group.address,
      email: group.email,
      contact: group.contact,
      logo:
        group.logo_file && !group.logo_file.deleted_at ? shapeFileSummary(group.logo_file) : null,
    },
    members: group.members.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      role: m.role,
      joinedAt: m.joined_at.toISOString(),
      isOwner: m.user_id === group.owner_id,
    })),
    // Only expose invite links to group owner or admins with manage_groups
    inviteLinks: canManage
      ? group.invite_links.map((link) => ({
          id: link.id,
          groupId: link.group_id,
          label: link.label,
          maxUsage: link.max_usage,
          currentUsage: link.current_usage,
          expiresAt: link.expires_at.toISOString(),
          createdBy: link.created_by,
          createdAt: link.created_at.toISOString(),
          deletedAt: link.deleted_at?.toISOString() ?? null,
          deletedBy: link.deleted_by,
          usages: link.usages.map((u) => ({
            id: u.id,
            userId: u.user_id,
            usedAt: u.used_at.toISOString(),
          })),
          canRevoke: !link.deleted_at,
        }))
      : [],
    elections,
  };
}

/**
 * @swagger
 * /api/groups/{id}:
 *   get:
 *     summary: Get group details including members and invite links
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  try {
    const detail = await fetchGroupDetail(id, auth.user);
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }
}

/**
 * @swagger
 * /api/groups/{id}:
 *   patch:
 *     summary: Update a group (rename and/or change type)
 *     description: >
 *       Two independent fields, each gated by its own permission:
 *
 *       - `name` — only the group owner may rename the group.
 *       - `type` — only admins with `manage_groups` may change the group type.
 *
 *       The body may contain either or both fields.  At least one must be present.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               type:
 *                 type: string
 *                 enum: [VKSU, OTHER]
 */
interface RequisitesPatch {
  fullName?: string | null;
  address?: string | null;
  email?: string | null;
  contact?: string | null;
  logoFileId?: string | null;
}

function normalizeRequisiteField(
  value: unknown,
  fieldName: string,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') {
    return { ok: false, error: `requisites.${fieldName} must be a string or null` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `requisites.${fieldName} must be at most ${maxLength} characters`,
    };
  }
  return { ok: true, value: trimmed };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  let body: { name?: string; type?: 'VKSU' | 'OTHER'; requisites?: RequisitesPatch };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const wantsRename = body.name !== undefined;
  const wantsTypeChange = body.type !== undefined;
  const wantsRequisites = body.requisites !== undefined;
  if (!wantsRename && !wantsTypeChange && !wantsRequisites) {
    return Errors.badRequest('At least one of name, type or requisites is required');
  }

  let trimmedName: string | undefined;
  if (wantsRename) {
    trimmedName = body.name?.trim();
    if (!trimmedName) return Errors.badRequest('name is required');
    if (trimmedName.length > GROUP_NAME_MAX_LENGTH) {
      return Errors.badRequest(`name must be at most ${GROUP_NAME_MAX_LENGTH} characters`);
    }
  }

  if (wantsTypeChange && body.type !== 'VKSU' && body.type !== 'OTHER') {
    return Errors.badRequest('type must be VKSU or OTHER');
  }

  let normalizedRequisites: {
    full_name?: string | null;
    address?: string | null;
    email?: string | null;
    contact?: string | null;
    logo_file_id?: string | null;
  } | null = null;

  if (wantsRequisites) {
    const r = body.requisites;
    if (!r || typeof r !== 'object') return Errors.badRequest('requisites must be an object');
    normalizedRequisites = {};
    const fields: ReadonlyArray<[keyof RequisitesPatch, string, number, string]> = [
      ['fullName', 'full_name', GROUP_REQUISITES_FULL_NAME_MAX_LENGTH, 'fullName'],
      ['address', 'address', GROUP_REQUISITES_ADDRESS_MAX_LENGTH, 'address'],
      ['email', 'email', GROUP_REQUISITES_EMAIL_MAX_LENGTH, 'email'],
      ['contact', 'contact', GROUP_REQUISITES_CONTACT_MAX_LENGTH, 'contact'],
    ];
    for (const [apiKey, dbKey, max, label] of fields) {
      if (!(apiKey in r)) continue;
      const result = normalizeRequisiteField(r[apiKey], label, max);
      if (!result.ok) return Errors.badRequest(result.error);
      (normalizedRequisites as Record<string, string | null>)[dbKey] = result.value;
    }
    if ('logoFileId' in r) {
      if (r.logoFileId === null) {
        normalizedRequisites.logo_file_id = null;
      } else if (typeof r.logoFileId === 'string' && isValidUuid(r.logoFileId)) {
        const file = await prisma.file.findUnique({
          where: { id: r.logoFileId },
          select: { id: true, mime_type: true, deleted_at: true },
        });
        if (!file || file.deleted_at) {
          return Errors.badRequest('requisites.logoFileId points to a missing file');
        }
        if (!isAllowedImageMime(file.mime_type)) {
          return Errors.badRequest('requisites.logoFileId must reference an image file');
        }
        normalizedRequisites.logo_file_id = file.id;
      } else {
        return Errors.badRequest('requisites.logoFileId must be a UUID or null');
      }
    }
    if (Object.keys(normalizedRequisites).length === 0) {
      return Errors.badRequest('requisites must include at least one field');
    }
    if ('email' in normalizedRequisites && normalizedRequisites.email) {
      // Light-touch check — protocol API does its own validation; we just guard
      // against obvious garbage.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRequisites.email)) {
        return Errors.badRequest('requisites.email must be a valid email address');
      }
    }
  }

  const group = await prisma.group.findUnique({
    where: { id },
    select: { owner_id: true, deleted_at: true, type: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  if (wantsRename && group.owner_id !== auth.user.sub) {
    return Errors.forbidden('Only the group owner can rename the group');
  }

  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);
  if (wantsTypeChange && !isAdminWithManageGroups) {
    return Errors.forbidden('Only admins with manage_groups can change group type');
  }

  if (wantsRequisites && group.owner_id !== auth.user.sub) {
    return Errors.forbidden('Only the group owner can edit group requisites');
  }

  const update: {
    name?: string;
    type?: 'VKSU' | 'OTHER';
    updated_by: string;
    full_name?: string | null;
    address?: string | null;
    email?: string | null;
    contact?: string | null;
    logo_file_id?: string | null;
  } = {
    updated_by: auth.user.sub,
  };
  if (wantsRename) update.name = trimmedName!;
  if (wantsTypeChange) update.type = body.type;
  if (normalizedRequisites) Object.assign(update, normalizedRequisites);

  await prisma.group.update({ where: { id }, data: update });

  const invalidations: Promise<unknown>[] = [];
  if (wantsRename) {
    invalidations.push(invalidateUserOwnedGroups(auth.user.sub));
  }
  if (wantsTypeChange && group.type !== body.type) {
    invalidations.push(invalidateVKSUGroupIds());
  }
  await Promise.all(invalidations);

  return new NextResponse(null, { status: 204 });
}

/**
 * @swagger
 * /api/groups/{id}:
 *   delete:
 *     summary: Soft-delete a group
 *     description: >
 *       Marks the group as deleted.  Only the group owner or an admin with
 *       manage_groups may delete a group.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id },
    select: {
      owner_id: true,
      deleted_at: true,
      type: true,
      members: {
        where: { deleted_at: null },
        select: { user_id: true },
      },
    },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  if (group.owner_id !== auth.user.sub && !isAdminWithManageGroups) {
    return Errors.forbidden('Only the group owner or a groups admin can delete this group');
  }

  const now = new Date();

  await prisma.group.update({
    where: { id },
    data: { deleted_at: now, deleted_by: auth.user.sub },
  });

  // Invalidate membership caches for all members so their election eligibility
  // is immediately re-evaluated
  const memberIds = group.members.map((m) => m.user_id);
  const invalidations: Promise<unknown>[] = [
    invalidateGroupMembershipsForUsers(memberIds),
    invalidateUserOwnedGroups(group.owner_id),
  ];
  if (group.type === 'VKSU') invalidations.push(invalidateVKSUGroupIds());
  await Promise.all(invalidations);

  return new NextResponse(null, { status: 204 });
}

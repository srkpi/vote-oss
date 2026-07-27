import { safeDecrypt } from '@/lib/elections-view';
import { prisma } from '@/lib/prisma';
import type { VerifiedPayload } from '@/types/auth';
import type { Comment, CommentAuthor } from '@/types/comment';

export interface PetitionGate {
  id: string;
  approved: boolean;
  createdBy: string;
  commentsClosed: boolean;
}

export type PetitionAccessResult =
  | { ok: true; petition: PetitionGate; isPetitionManager: boolean }
  | { ok: false; status: 404 | 400; message: string };

/**
 * Loads a petition and applies the same visibility rules already
 * established by GET /api/elections/[id]/signatories:
 *   - must be type PETITION (400 — wrong resource type, not "not found")
 *   - approved petitions are visible to any authenticated user
 *   - unapproved petitions are visible only to their creator or an
 *     admin with manage_petitions
 *   - soft-deleted petitions are visible only to admins
 *
 * Always reads fresh from the database (not the elections list cache),
 * since callers need up-to-date comments_closed state and this is a
 * single indexed PK lookup — not worth threading through the cache.
 */
export async function getPetitionGate(
  electionId: string,
  user: VerifiedPayload,
): Promise<PetitionAccessResult> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      type: true,
      approved: true,
      created_by: true,
      deleted_at: true,
      comments_closed: true,
    },
  });

  if (!election) return { ok: false, status: 404, message: 'Petition not found' };
  if (election.type !== 'PETITION') {
    return { ok: false, status: 400, message: 'Comments are only available for petitions' };
  }

  const isAdmin = user.isAdmin ?? false;
  const isPetitionManager = isAdmin && user.managePetitions === true;

  if (!isAdmin && election.deleted_at) {
    return { ok: false, status: 404, message: 'Petition not found' };
  }
  if (!election.approved && !isPetitionManager && election.created_by !== user.sub) {
    return { ok: false, status: 404, message: 'Petition not found' };
  }

  return {
    ok: true,
    isPetitionManager,
    petition: {
      id: election.id,
      approved: election.approved,
      createdBy: election.created_by,
      commentsClosed: election.comments_closed,
    },
  };
}

type CommentRow = {
  id: string;
  user_id: string;
  full_name: string;
  body: string;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  deleted_by_full_name: string | null;
  up_count: number;
  down_count: number;
};

export interface ShapeCommentContext {
  petitionCreatedBy: string;
  adminUserIds: ReadonlySet<string>;
  requesterUserId: string;
  requesterIsPetitionManager: boolean;
  myVotes: ReadonlyMap<string, 'UP' | 'DOWN'>;
}

/**
 * Shapes a raw comment row for the API. Deleted comments never expose
 * their original text, even though the row keeps it for moderation
 * history — the client renders the "deleted" placeholder purely from
 * `deletedAt`.
 */
export function shapeComment(
  row: CommentRow,
  ctx: ShapeCommentContext,
  avatarMap: Map<string, string>,
): Comment {
  const isDeleted = row.deleted_at !== null;
  const author: CommentAuthor = {
    userId: row.user_id,
    fullName: safeDecrypt(row.full_name),
    avatarUrl: avatarMap.get(row.user_id) ?? null,
  };

  return {
    id: row.id,
    body: isDeleted ? '' : row.body,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at ? row.edited_at.toISOString() : null,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    deletedBy:
      row.deleted_at && row.deleted_by
        ? {
            userId: row.deleted_by,
            fullName: safeDecrypt(row.deleted_by_full_name ?? ''),
            avatarUrl: avatarMap.get(row.user_id) ?? null,
          }
        : null,
    author,
    isPetitionAuthor: row.user_id === ctx.petitionCreatedBy,
    isAdmin: ctx.adminUserIds.has(row.user_id),
    canEdit: !isDeleted && row.user_id === ctx.requesterUserId,
    canDelete:
      !isDeleted && (row.user_id === ctx.requesterUserId || ctx.requesterIsPetitionManager),
    upCount: row.up_count,
    downCount: row.down_count,
    myVote: isDeleted ? null : (ctx.myVotes.get(row.id) ?? null),
  };
}

/** Batched "is this user currently an admin" check — one query per page, not per row. */
export async function getAdminUserIdSet(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const admins = await prisma.admin.findMany({
    where: { user_id: { in: userIds }, deleted_at: null },
    select: { user_id: true },
  });
  return new Set(admins.map((a) => a.user_id));
}

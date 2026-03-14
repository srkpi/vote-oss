/**
 * Token store
 *
 * Centralises all token-lifecycle operations so the auth routes and
 * middleware don't need to know whether we're talking to Redis or the DB.
 *
 * Revocation strategy
 * ───────────────────
 * 1. Happy-path auth check:
 *      a. JWT signature + expiry verified by jose (no I/O).
 *      b. `iat` compared against bloom reset-time – tokens older than the
 *         last reset are rejected without any further I/O.
 *      c. Bloom-filter check.  If CLEAN → accept immediately (no DB query).
 *      d. If REVOKED → reject.
 *      e. If FALSE-POSITIVE / Redis down → fall back to DB whitelist.
 *
 * 2. Revocation (logout / token rotation):
 *      a. Insert JTI into bloom filter + per-key confirmation entry (Redis).
 *      b. Delete DB record (keeps the table small; audit rows can be kept
 *         with a different retention policy if needed).
 *
 * The DB `jwt_tokens` table is therefore no longer on the hot read path –
 * it is only written to (on issue) and read from (fallback / false-positive).
 */

import { bloomAdd, getBloomResetAt, isTokenClean } from '@/lib/bloom';
import { ACCESS_TOKEN_TTL_SECS, REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { safeRedis } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Issuance
// ---------------------------------------------------------------------------

/**
 * Persist a newly-issued token pair.
 * The DB record is kept for audit / fallback; the hot path never reads it.
 */
export async function persistTokenPair(accessJti: string, refreshJti: string): Promise<void> {
  await prisma.jwtToken.create({
    data: {
      access_jti: accessJti,
      refresh_jti: refreshJti,
      created_at: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check whether an access token's JTI is still valid.
 *
 * Returns `true`  if the token is valid (not revoked).
 * Returns `false` if the token is revoked or its `iat` predates a bloom reset.
 *
 * @param jti JWT ID extracted from the verified payload
 * @param iat Issued-at timestamp in **seconds** (as stored in the JWT)
 */
export async function isAccessTokenValid(jti: string, iat: number): Promise<boolean> {
  // ── Step 1: reset-time gate ──────────────────────────────────────────────
  const resetAt = await getBloomResetAt();
  if (resetAt > 0 && iat * 1_000 < resetAt) {
    // Token was issued before the last bloom reset → force re-authentication
    return false;
  }

  // ── Step 2: bloom filter (fast path) ────────────────────────────────────
  const bloomResult = await isTokenClean(jti);

  if (bloomResult === true) {
    // Definitely not revoked – no DB query needed
    return true;
  }

  if (bloomResult === false) {
    // Confirmed revoked by the per-key entry
    return false;
  }

  // ── Step 3: Redis unavailable → fall back to DB whitelist ────────────────
  const record = await prisma.jwtToken.findFirst({
    where: { access_jti: jti },
    select: { access_jti: true },
  });

  return record !== null;
}

/**
 * Check whether a refresh token's JTI is still valid.
 * Same logic as `isAccessTokenValid` but queries `refresh_jti` for the fallback.
 */
export async function isRefreshTokenValid(jti: string, iat: number): Promise<boolean> {
  const resetAt = await getBloomResetAt();
  if (resetAt > 0 && iat * 1_000 < resetAt) {
    const record = await prisma.jwtToken.findFirst({
      where: { refresh_jti: jti },
      select: { refresh_jti: true },
    });

    return record !== null;
  }

  const bloomResult = await isTokenClean(jti);

  if (bloomResult === true) return true;
  if (bloomResult === false) return false;

  const record = await prisma.jwtToken.findFirst({
    where: { refresh_jti: jti },
    select: { refresh_jti: true },
  });

  return record !== null;
}

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

/**
 * Revoke an access + refresh token pair by their JTIs.
 * Writes both JTIs into the bloom filter and deletes the DB record.
 *
 * @param accessJti  JTI of the access token
 * @param refreshJti JTI of the refresh token
 * @param accessIat  Issued-at of the access token (seconds) – used to compute TTL
 * @param refreshIat Issued-at of the refresh token (seconds)
 */
export async function revokeTokenPair(
  accessJti: string,
  refreshJti: string,
  accessIat: number,
  refreshIat: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1_000);

  const accessTtl = Math.max(1, accessIat + ACCESS_TOKEN_TTL_SECS - now);
  const refreshTtl = Math.max(1, refreshIat + REFRESH_TOKEN_TTL_SECS - now);

  await Promise.all([
    bloomAdd(accessJti, accessTtl),
    bloomAdd(refreshJti, refreshTtl),
    prisma.jwtToken.deleteMany({ where: { access_jti: accessJti } }),
  ]);
}

/**
 * Revoke a single refresh token (used during token rotation).
 * The old access token should already be close to expiry, but we revoke it
 * too for defence-in-depth.
 */
export async function revokeByRefreshJti(
  refreshJti: string,
  refreshIat: number,
): Promise<{ accessJti: string | null }> {
  const now = Math.floor(Date.now() / 1_000);

  // Look up the sibling access JTI so we can bloom-add it too
  const record = await prisma.jwtToken.findFirst({
    where: { refresh_jti: refreshJti },
    select: { access_jti: true },
  });

  const refreshTtl = Math.max(1, refreshIat + REFRESH_TOKEN_TTL_SECS - now);
  const accessTtl = ACCESS_TOKEN_TTL_SECS; // conservative upper bound

  const ops: Promise<unknown>[] = [
    bloomAdd(refreshJti, refreshTtl),
    prisma.jwtToken.deleteMany({ where: { refresh_jti: refreshJti } }),
  ];

  if (record?.access_jti) {
    ops.push(bloomAdd(record.access_jti, accessTtl));
  }

  await Promise.all(ops);

  return { accessJti: record?.access_jti ?? null };
}

// ---------------------------------------------------------------------------
// Logout helper (access-token-first lookup)
// ---------------------------------------------------------------------------

/**
 * Full logout: look up the token pair by access JTI, revoke both sides.
 */
export async function revokeByAccessJti(accessJti: string, accessIat: number): Promise<void> {
  const now = Math.floor(Date.now() / 1_000);
  const accessTtl = Math.max(1, accessIat + ACCESS_TOKEN_TTL_SECS - now);

  // Bloom the access token immediately (don't wait for DB lookup)
  const bloomAccessOp = bloomAdd(accessJti, accessTtl);

  // Fetch sibling refresh JTI
  const record = await prisma.jwtToken.findFirst({
    where: { access_jti: accessJti },
    select: { refresh_jti: true, created_at: true },
  });

  const ops: Promise<unknown>[] = [
    bloomAccessOp,
    prisma.jwtToken.deleteMany({ where: { access_jti: accessJti } }),
  ];

  if (record?.refresh_jti) {
    const refreshIat = Math.floor(record.created_at.getTime() / 1_000);
    const refreshTtl = Math.max(1, refreshIat + REFRESH_TOKEN_TTL_SECS - now);
    ops.push(bloomAdd(record.refresh_jti, refreshTtl));
  }

  await Promise.all(ops);
}

// ---------------------------------------------------------------------------
// Admin-session cache invalidation
// ---------------------------------------------------------------------------

/**
 * When an admin record changes (promoted, removed, etc.) the admin cache
 * should be invalidated.  This is a best-effort operation; staleness is
 * acceptable for up to ADMIN_CACHE_TTL seconds.
 */
export async function invalidateAdminCache(): Promise<void> {
  await safeRedis(() => import('@/lib/cache').then((m) => m.invalidateAdmins()));
}

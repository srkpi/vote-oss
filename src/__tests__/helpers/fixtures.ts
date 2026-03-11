import { constants, publicEncrypt } from 'crypto';

import {
  computeNullifier,
  generateElectionKeyPair,
  generateVoteToken,
  signVoteToken,
} from '@/lib/crypto';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import type { AdminPromoter } from '@/types/admin';

// ---------------------------------------------------------------------------
// JWT payload fixtures
// ---------------------------------------------------------------------------

export const USER_PAYLOAD = {
  sub: 'user-001',
  faculty: 'FICE',
  group: 'KV-91',
  full_name: 'Ivan Petrenko',
  is_admin: false,
  restricted_to_faculty: false,
  manage_admins: false,
};

export const ADMIN_PAYLOAD = {
  sub: 'superadmin-001',
  faculty: 'FICE',
  group: 'KV-11',
  full_name: 'Super Admin User',
  is_admin: true,
  restricted_to_faculty: false,
  manage_admins: true,
};

export const OTHER_FACULTY_PAYLOAD = {
  sub: 'user-002',
  faculty: 'FEL',
  group: 'EL-21',
  full_name: 'Olena Kovalchuk',
  is_admin: false,
  restricted_to_faculty: false,
  manage_admins: false,
};

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/** Returns signed access + refresh tokens for the given payload. */
export async function makeTokenPair(payload = USER_PAYLOAD) {
  const [access, refresh] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);
  return { access, refresh };
}

// ---------------------------------------------------------------------------
// Admin DB fixtures
// All records include the soft-delete columns (null = active).
// `promoter` is the hydrated relation; `promoted_by` FK is intentionally
// absent from the public shape to avoid redundancy.
// ---------------------------------------------------------------------------

export const ADMIN_RECORD = {
  user_id: 'superadmin-001',
  full_name: 'Super Admin User',
  group: 'KV-11',
  faculty: 'FICE',
  /** Root admin — no promoter. */
  promoter: null as AdminPromoter | null,
  promoted_at: new Date('2024-01-01'),
  manage_admins: true,
  restricted_to_faculty: false,
  deleted_at: null as Date | null,
  deleted_by: null as string | null,
};

export const RESTRICTED_ADMIN_RECORD = {
  user_id: 'admin-002',
  full_name: 'Faculty Admin FICE',
  group: 'KV-12',
  faculty: 'FICE',
  promoter: { user_id: 'superadmin-001', full_name: 'Super Admin User' } as AdminPromoter | null,
  promoted_at: new Date('2024-01-02'),
  manage_admins: true,
  restricted_to_faculty: true,
  deleted_at: null as Date | null,
  deleted_by: null as string | null,
};

/**
 * A previously-active admin who has been soft-deleted.
 * `promoter` is intentionally preserved to keep the hierarchy chain intact.
 */
export const DELETED_ADMIN_RECORD = {
  ...RESTRICTED_ADMIN_RECORD,
  user_id: 'admin-002',
  deleted_at: new Date('2024-06-01'),
  deleted_by: 'superadmin-001',
};

// ---------------------------------------------------------------------------
// jwt_tokens DB record fixture
// Used in token-store DB-fallback tests and as a reference shape.
// ---------------------------------------------------------------------------

export const JWT_TOKEN_RECORD = {
  access_jti: 'access-jti-stub',
  refresh_jti: 'refresh-jti-stub',
  created_at: new Date(),
};

// ---------------------------------------------------------------------------
// Election helpers
// ---------------------------------------------------------------------------

export function makeElection(overrides: Partial<ReturnType<typeof makeElectionBase>> = {}) {
  const keys = generateElectionKeyPair();
  return { ...makeElectionBase(keys), ...overrides };
}

export const MOCK_ELECTION_ID = '550e8400-e29b-41d4-a716-446655440000';
export const MOCK_ELECTION_ID_NOT_EXISTING = '550e8400-e29b-41d4-a716-446655440999';

export const MOCK_ELECTION_CHOICES = [
  { id: '550e8400-e29b-41d4-a716-446655441000', election_id: 1, choice: 'Option A', position: 0 },
  { id: '550e8400-e29b-41d4-a716-446655441001', election_id: 1, choice: 'Option B', position: 1 },
];
export const MOCK_ELECTION_INVALID_CHOICE_ID = '550e8400-e29b-41d4-a716-446655441999';

function makeElectionBase(keys: { publicKey: string; privateKey: string }) {
  const now = new Date();
  return {
    id: MOCK_ELECTION_ID,
    title: 'Test Election',
    created_by: 'superadmin-001',
    created_at: new Date('2024-01-01'),
    opens_at: new Date(now.getTime() - 60_000), // opened 1 min ago
    closes_at: new Date(now.getTime() + 3_600_000), // closes in 1 hour
    restricted_to_faculty: null as string | null,
    restricted_to_group: null as string | null,
    public_key: keys.publicKey,
    private_key: keys.privateKey,
    creator: { full_name: 'Super Admin User', faculty: 'FICE' },
    choices: MOCK_ELECTION_CHOICES,
    tallies: [] as unknown[],
    _count: { ballots: 0 },
  };
}

/** Encrypt a choice ID with the election's RSA public key (OAEP/SHA-256). */
export function encryptChoice(publicKeyPem: string, choiceId: string): string {
  const buf = publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(String(choiceId)),
  );
  return buf.toString('base64');
}

/** Build a valid vote submission payload for a given election + choice. */
export function makeVoteBallot(
  election: ReturnType<typeof makeElection>,
  choiceId: string = MOCK_ELECTION_CHOICES[0].id,
) {
  const { token } = generateVoteToken(election.id);
  const signature = signVoteToken(election.private_key, token);
  const nullifier = computeNullifier(token);
  const encryptedBallot = encryptChoice(election.public_key, choiceId);
  return { token, signature, nullifier, encryptedBallot };
}

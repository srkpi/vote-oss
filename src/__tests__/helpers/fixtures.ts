import { constants, publicEncrypt } from 'crypto';

import {
  computeNullifier,
  generateElectionKeyPair,
  generateVoteToken,
  signVoteToken,
} from '@/lib/crypto';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import type { Admin } from '@/types/admin';
import type { TokenPayload } from '@/types/auth';

export const USER_PAYLOAD: TokenPayload = {
  sub: 'user-001',
  faculty: 'FICE',
  group: 'KV-91',
  fullName: 'Ivan Petrenko',
  speciality: 'Computer Science',
  studyYear: 3,
  studyForm: 'FullTime',
  isAdmin: false,
  restrictedToFaculty: false,
  manageAdmins: false,
};

export const ADMIN_PAYLOAD: TokenPayload = {
  sub: 'superadmin-001',
  faculty: 'FICE',
  group: 'KV-11',
  fullName: 'Super Admin User',
  isAdmin: true,
  restrictedToFaculty: false,
  manageAdmins: true,
};

export const OTHER_FACULTY_PAYLOAD: TokenPayload = {
  sub: 'user-002',
  faculty: 'FEL',
  group: 'EL-21',
  fullName: 'Olena Kovalchuk',
  speciality: undefined,
  studyYear: 2,
  studyForm: 'FullTime',
  isAdmin: false,
  restrictedToFaculty: false,
  manageAdmins: false,
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
// Admin DB fixtures (snake_case — these mock Prisma return values)
// ---------------------------------------------------------------------------

export const ADMIN_RECORD = {
  user_id: 'superadmin-001',
  full_name: 'Super Admin User',
  group: 'KV-11',
  faculty: 'FICE',
  promoter: null as null | { user_id: string; full_name: string },
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
  promoter: { user_id: 'superadmin-001', full_name: 'Super Admin User' } as null | {
    user_id: string;
    full_name: string;
  },
  promoted_at: new Date('2024-01-02'),
  manage_admins: true,
  restricted_to_faculty: true,
  deleted_at: null as Date | null,
  deleted_by: null as string | null,
};

/**
 * A previously-active admin who has been soft-deleted.
 */
export const DELETED_ADMIN_RECORD = {
  ...RESTRICTED_ADMIN_RECORD,
  user_id: 'admin-002',
  deleted_at: new Date('2024-06-01'),
  deleted_by: 'superadmin-001',
};

// ---------------------------------------------------------------------------
// Admin API response fixtures (camelCase — use these when mocking the cache)
// ---------------------------------------------------------------------------

export const ADMIN_API: Admin = {
  userId: 'superadmin-001',
  fullName: 'Super Admin User',
  group: 'KV-11',
  faculty: 'FICE',
  promoter: null,
  promotedAt: new Date('2024-01-01').toISOString(),
  manageAdmins: true,
  restrictedToFaculty: false,
};

export const RESTRICTED_ADMIN_API: Admin = {
  userId: 'admin-002',
  fullName: 'Faculty Admin FICE',
  group: 'KV-12',
  faculty: 'FICE',
  promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
  promotedAt: new Date('2024-01-02').toISOString(),
  manageAdmins: true,
  restrictedToFaculty: true,
};

// ---------------------------------------------------------------------------
// jwt_tokens DB record fixture
// ---------------------------------------------------------------------------

export const JWT_TOKEN_RECORD = {
  access_jti: 'access-jti-stub',
  refresh_jti: 'refresh-jti-stub',
  created_at: new Date(),
};

// ---------------------------------------------------------------------------
// Election helpers
// ---------------------------------------------------------------------------

export const MOCK_ELECTION_ID = '550e8400-e29b-41d4-a716-446655440000';
export const MOCK_ELECTION_ID_NOT_EXISTING = '550e8400-e29b-41d4-a716-446655440999';

export const MOCK_ELECTION_CHOICES = [
  {
    id: '550e8400-e29b-41d4-a716-446655441000',
    election_id: MOCK_ELECTION_ID,
    choice: 'Option A',
    position: 0,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655441001',
    election_id: MOCK_ELECTION_ID,
    choice: 'Option B',
    position: 1,
  },
];
export const MOCK_ELECTION_INVALID_CHOICE_ID = '550e8400-e29b-41d4-a716-446655441999';

function makeElectionBase(keys: { publicKey: string; privateKey: string }) {
  const now = new Date();
  return {
    id: MOCK_ELECTION_ID,
    title: 'Test Election',
    created_by: 'superadmin-001',
    created_at: new Date('2024-01-01'),
    opens_at: new Date(now.getTime() - 60_000),
    closes_at: new Date(now.getTime() + 3_600_000),
    min_choices: 1,
    max_choices: 1,
    restrictions: [] as { type: string; value: string }[],
    public_key: keys.publicKey,
    private_key: keys.privateKey,
    creator: { full_name: 'Super Admin User', faculty: 'FICE' },
    choices: MOCK_ELECTION_CHOICES,
    tallies: [] as unknown[],
    _count: { ballots: 0 },
  };
}

export function makeElection(overrides: Partial<ReturnType<typeof makeElectionBase>> = {}) {
  const keys = generateElectionKeyPair();
  return { ...makeElectionBase(keys), ...overrides };
}

/** Encrypt one or more choice IDs with the election RSA public key. */
export function encryptChoice(publicKeyPem: string, choiceIds: string | string[]): string {
  const ids = Array.isArray(choiceIds) ? choiceIds : [choiceIds];
  const buf = publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(JSON.stringify(ids)),
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
  const encryptedBallot = encryptChoice(election.public_key, [choiceId]);
  return { token, signature, nullifier, encryptedBallot };
}

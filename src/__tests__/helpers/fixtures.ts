import {
  computeNullifier,
  encryptBallot,
  generateElectionKeyPair,
  generateVoteToken,
  signVoteToken,
} from '@/lib/crypto';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import type { Admin } from '@/types/admin';
import type { TokenPayload } from '@/types/auth';
import type { WinningConditions } from '@/types/election';
import { DEFAULT_WINNING_CONDITIONS } from '@/types/election';

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

export const RESTRICTED_ADMIN_PAYLOAD: TokenPayload = {
  sub: 'admin-002',
  faculty: 'FICE',
  group: 'KV-12',
  fullName: 'Faculty Admin FICE',
  isAdmin: true,
  restrictedToFaculty: true,
  manageAdmins: false,
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

export async function makeTokenPair(payload = USER_PAYLOAD) {
  const [access, refresh] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);
  return { access, refresh };
}

// ---------------------------------------------------------------------------
// Admin DB fixtures
// ---------------------------------------------------------------------------

export const ADMIN_RECORD = {
  user_id: 'superadmin-001',
  full_name: 'Super Admin User',
  group: 'KV-11',
  faculty: 'FICE',
  promoted_by: null as string | null,
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
  promoted_by: 'superadmin-001' as string | null,
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

export const DELETED_ADMIN_RECORD = {
  ...RESTRICTED_ADMIN_RECORD,
  user_id: 'admin-002',
  deleted_at: new Date('2024-06-01'),
  deleted_by: 'superadmin-001',
};

// ---------------------------------------------------------------------------
// Admin API response fixtures
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
  manageGroups: true,
  managePetitions: true,
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
  manageGroups: false,
  managePetitions: false,
};

export const MOCK_ADMIN_GRAPH = new Map<string, string | null>([
  ['superadmin-001', null],
  ['admin-002', 'superadmin-001'],
]);

// ---------------------------------------------------------------------------
// JWT token record fixture
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
    vote_count: null as number | null,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655441001',
    election_id: MOCK_ELECTION_ID,
    choice: 'Option B',
    position: 1,
    vote_count: null as number | null,
  },
];
export const MOCK_ELECTION_INVALID_CHOICE_ID = '550e8400-e29b-41d4-a716-446655441999';

function makeElectionBase(keys: { publicKey: string; privateKey: string }) {
  const now = new Date();
  return {
    id: MOCK_ELECTION_ID,
    type: 'ELECTION' as 'ELECTION' | 'PETITION',
    title: 'Test Election',
    description: null as string | null,
    created_by: 'superadmin-001',
    created_by_full_name: 'Super Admin User',
    created_at: new Date('2024-01-01'),
    opens_at: new Date(now.getTime() - 60_000),
    closes_at: new Date(now.getTime() + 3_600_000),
    min_choices: 1,
    max_choices: 1,
    shuffle_choices: false,
    public_viewing: false,
    anonymous: true,
    approved: true,
    approved_by_id: 'superadmin-001' as string | null,
    approved_by_full_name: 'Super Admin User' as string | null,
    approved_at: new Date('2024-01-01') as Date | null,
    restrictions: [] as { type: string; value: string }[],
    winning_conditions: DEFAULT_WINNING_CONDITIONS as unknown,
    public_key: keys.publicKey,
    private_key: keys.privateKey,
    deleter: null as { full_name: string } | null,
    choices: MOCK_ELECTION_CHOICES,
    _count: { ballots: 0 },
    deleted_at: null as Date | null,
    deleted_by: null as string | null,
  };
}

export function makeElection(
  overrides: Partial<ReturnType<typeof makeElectionBase>> & {
    winningConditions?: WinningConditions;
  } = {},
) {
  const keys = generateElectionKeyPair();
  const { winningConditions, ...rest } = overrides;
  const base = makeElectionBase(keys);
  return {
    ...base,
    ...rest,
    winning_conditions: (winningConditions ??
      (rest.winning_conditions as WinningConditions | undefined) ??
      DEFAULT_WINNING_CONDITIONS) as unknown,
  };
}

export function makeDeletedElection(
  overrides: Partial<ReturnType<typeof makeElectionBase>> = {},
  deletedBy = 'admin-002',
) {
  return makeElection({
    deleted_at: new Date('2024-06-01T12:00:00Z'),
    deleted_by: deletedBy,
    deleter: { full_name: deletedBy === 'admin-002' ? 'Faculty Admin FICE' : 'Super Admin User' },
    ...overrides,
  });
}

export { encryptBallot };

export function makeVoteBallot(
  election: ReturnType<typeof makeElection>,
  choiceIds: string | string[] = MOCK_ELECTION_CHOICES[0].id,
) {
  const ids = Array.isArray(choiceIds) ? choiceIds : [choiceIds];
  const { token } = generateVoteToken(election.id);
  const signature = signVoteToken(election.private_key, token);
  const nullifier = computeNullifier(token);
  const encryptedBallot = encryptBallot(election.public_key, ids, election.max_choices);
  return { token, signature, nullifier, encryptedBallot };
}

// ---------------------------------------------------------------------------
// Bypass token fixtures — split by type
// ---------------------------------------------------------------------------

export const MOCK_BYPASS_TOKEN_HASH = 'aabbccdd'.repeat(8);

/** Factory for GlobalBypassToken DB records */
export function makeGlobalBypassToken(
  overrides: Partial<{
    token_hash: string;
    bypass_not_studying: boolean;
    bypass_graduate: boolean;
    max_usage: number;
    current_usage: number;
    valid_until: Date;
    created_by: string;
  }> = {},
) {
  return {
    token_hash: MOCK_BYPASS_TOKEN_HASH,
    bypass_not_studying: true,
    bypass_graduate: false,
    max_usage: 1,
    current_usage: 0,
    valid_until: new Date(Date.now() + 86_400_000),
    created_at: new Date(),
    created_by: 'superadmin-001',
    ...overrides,
  };
}

/** Factory for ElectionBypassToken DB records */
export function makeElectionBypassToken(
  electionId: string,
  bypassRestrictions: string[] = ['FACULTY'],
  overrides: Partial<{
    token_hash: string;
    max_usage: number;
    current_usage: number;
    created_by: string;
  }> = {},
) {
  return {
    token_hash: MOCK_BYPASS_TOKEN_HASH,
    election_id: electionId,
    bypass_restrictions: bypassRestrictions,
    max_usage: 1,
    current_usage: 0,
    created_at: new Date(),
    created_by: 'superadmin-001',
    ...overrides,
  };
}

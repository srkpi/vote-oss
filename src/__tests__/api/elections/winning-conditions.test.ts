import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { campusMock, resetCampusMock } from '@/__tests__/helpers/campus-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  encryptBallot,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_CHOICES,
  MOCK_ELECTION_ID,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import {
  WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE,
  WINNING_CONDITION_PERCENTAGE_MIN,
  WINNING_CONDITION_QUORUM_MAX,
  WINNING_CONDITION_QUORUM_MIN,
  WINNING_CONDITION_VOTES_MAX,
  WINNING_CONDITION_VOTES_MIN,
} from '@/lib/constants';
import { DEFAULT_WINNING_CONDITIONS } from '@/types/election';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);
jest.mock('@/lib/campus-api', () => campusMock);
jest.mock('@/lib/encryption', () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));
jest.mock('@/lib/bypass', () => ({
  getElectionBypassForUser: jest.fn().mockResolvedValue(null),
}));

import { GET } from '@/app/api/elections/[id]/route';
import { POST } from '@/app/api/elections/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE_OPEN = new Date(Date.now() + 3_600_000).toISOString();
const FUTURE_CLOSE = new Date(Date.now() + 7_200_000).toISOString();

const validBody = {
  title: 'Winning Conditions Test Election',
  opensAt: FUTURE_OPEN,
  closesAt: FUTURE_CLOSE,
  choices: ['Option A', 'Option B', 'Option C'],
};

async function makeAdminReq(body: object, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

async function makeUserReq() {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token);
}

const DETAIL_PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

function mockElectionCreate(winningConditions = DEFAULT_WINNING_CONDITIONS) {
  prismaMock.election.create.mockResolvedValueOnce({
    ...makeElection(),
    opens_at: new Date(FUTURE_OPEN),
    closes_at: new Date(FUTURE_CLOSE),
    winning_conditions: winningConditions as unknown,
    restrictions: [],
  });
}

// ---------------------------------------------------------------------------
// POST /api/elections — winning conditions validation
// ---------------------------------------------------------------------------

describe('POST /api/elections — winning conditions validation', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    resetCampusMock();
    allure.feature('Elections');
    allure.story('Create Election – Winning Conditions Validation');
  });

  // ── Default behaviour ─────────────────────────────────────────────────────

  it('creates election with default winning conditions when not provided', async () => {
    const req = await makeAdminReq(validBody);
    mockElectionCreate();
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
    expect(body.winningConditions).toEqual(DEFAULT_WINNING_CONDITIONS);
  });

  it('stores hasMostVotes=true as default', async () => {
    const req = await makeAdminReq(validBody);
    mockElectionCreate();
    const { body } = await parseJson<any>(await POST(req));
    expect(body.winningConditions.hasMostVotes).toBe(true);
    expect(body.winningConditions.reachesPercentage).toBeNull();
    expect(body.winningConditions.reachesVotes).toBeNull();
    expect(body.winningConditions.quorum).toBeNull();
  });

  // ── hasMostVotes ──────────────────────────────────────────────────────────

  it('accepts hasMostVotes: true explicitly', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: true },
    });
    mockElectionCreate({
      hasMostVotes: true,
      reachesPercentage: null,
      reachesVotes: null,
      quorum: null,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  it('accepts hasMostVotes: false with another condition', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: false, reachesVotes: 5 },
    });
    mockElectionCreate({
      hasMostVotes: false,
      reachesPercentage: null,
      reachesVotes: 5,
      quorum: null,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  // ── reachesPercentage validation ──────────────────────────────────────────

  it(`accepts reachesPercentage at minimum (${WINNING_CONDITION_PERCENTAGE_MIN})`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: {
        hasMostVotes: true,
        reachesPercentage: WINNING_CONDITION_PERCENTAGE_MIN,
      },
    });
    mockElectionCreate({
      hasMostVotes: true,
      reachesPercentage: WINNING_CONDITION_PERCENTAGE_MIN,
      reachesVotes: null,
      quorum: null,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  it('accepts reachesPercentage just below max (99)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: true, reachesPercentage: 99 },
    });
    mockElectionCreate({
      hasMostVotes: true,
      reachesPercentage: 99,
      reachesVotes: null,
      quorum: null,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  it(`rejects reachesPercentage >= ${WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE}`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesPercentage: WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE },
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/reachesPercentage/);
  });

  it('rejects reachesPercentage = 100', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesPercentage: 100 },
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('rejects reachesPercentage < 0', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesPercentage: -1 },
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('accepts decimal reachesPercentage within range (e.g. 50.5)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: true, reachesPercentage: 50.5 },
    });
    mockElectionCreate({
      hasMostVotes: true,
      reachesPercentage: 50.5,
      reachesVotes: null,
      quorum: null,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  // ── reachesVotes validation ───────────────────────────────────────────────

  it(`accepts reachesVotes at minimum (${WINNING_CONDITION_VOTES_MIN})`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesVotes: WINNING_CONDITION_VOTES_MIN },
    });
    mockElectionCreate({
      hasMostVotes: false,
      reachesPercentage: null,
      reachesVotes: WINNING_CONDITION_VOTES_MIN,
      quorum: null,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  it(`accepts reachesVotes at maximum (${WINNING_CONDITION_VOTES_MAX})`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesVotes: WINNING_CONDITION_VOTES_MAX },
    });
    mockElectionCreate({
      hasMostVotes: false,
      reachesPercentage: null,
      reachesVotes: WINNING_CONDITION_VOTES_MAX,
      quorum: null,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  it('rejects reachesVotes = 0 (below minimum)', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesVotes: 0 },
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/reachesVotes/);
  });

  it(`rejects reachesVotes above maximum (${WINNING_CONDITION_VOTES_MAX + 1})`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesVotes: WINNING_CONDITION_VOTES_MAX + 1 },
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('rejects non-integer reachesVotes', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesVotes: 5.5 },
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  // ── quorum validation ─────────────────────────────────────────────────────

  it(`accepts quorum at minimum (${WINNING_CONDITION_QUORUM_MIN})`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: true, quorum: WINNING_CONDITION_QUORUM_MIN },
    });
    mockElectionCreate({
      hasMostVotes: true,
      reachesPercentage: null,
      reachesVotes: null,
      quorum: WINNING_CONDITION_QUORUM_MIN,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  it(`accepts quorum at maximum (${WINNING_CONDITION_QUORUM_MAX})`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: true, quorum: WINNING_CONDITION_QUORUM_MAX },
    });
    mockElectionCreate({
      hasMostVotes: true,
      reachesPercentage: null,
      reachesVotes: null,
      quorum: WINNING_CONDITION_QUORUM_MAX,
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
  });

  it('rejects quorum = 0', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: true, quorum: 0 },
    });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/quorum/);
  });

  it(`rejects quorum above maximum (${WINNING_CONDITION_QUORUM_MAX + 1})`, async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { quorum: WINNING_CONDITION_QUORUM_MAX + 1 },
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('rejects non-integer quorum', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { hasMostVotes: true, quorum: 10.5 },
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  // ── Combined conditions ───────────────────────────────────────────────────

  it('accepts all conditions combined', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: {
        hasMostVotes: true,
        reachesPercentage: 50,
        reachesVotes: 10,
        quorum: 20,
      },
    });
    mockElectionCreate({ hasMostVotes: true, reachesPercentage: 50, reachesVotes: 10, quorum: 20 });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
    expect(body.winningConditions).toEqual({
      hasMostVotes: true,
      reachesPercentage: 50,
      reachesVotes: 10,
      quorum: 20,
    });
  });

  it('rejects non-object winningConditions', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: 'invalid',
    });
    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
  });

  it('includes bounds in the error message for invalid reachesPercentage', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesPercentage: 100 },
    });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(new RegExp(String(WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE)));
  });

  it('includes bounds in the error message for invalid reachesVotes', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { reachesVotes: WINNING_CONDITION_VOTES_MAX + 1 },
    });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(new RegExp(String(WINNING_CONDITION_VOTES_MAX)));
  });

  it('includes bounds in the error message for invalid quorum', async () => {
    const req = await makeAdminReq({
      ...validBody,
      winningConditions: { quorum: WINNING_CONDITION_QUORUM_MAX + 1 },
    });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(new RegExp(String(WINNING_CONDITION_QUORUM_MAX)));
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — winning conditions in response
// ---------------------------------------------------------------------------

describe('GET /api/elections/[id] — winning conditions in response', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Election Detail – Winning Conditions');
  });

  it('returns winningConditions on the detail response', async () => {
    const req = await makeUserReq();
    const conditions = {
      hasMostVotes: true,
      reachesPercentage: 50,
      reachesVotes: null,
      quorum: null,
    };
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ winningConditions: conditions }),
    );
    const { status, body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(status).toBe(200);
    expect(body.winningConditions).toEqual(conditions);
  });

  it('returns default winningConditions when stored as empty object', async () => {
    const req = await makeUserReq();
    const election = makeElection();
    // Simulate old DB record with empty JSON
    (election as any).winning_conditions = {};
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    // hasMostVotes defaults to true on parse
    expect(body.winningConditions.hasMostVotes).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — tally with hasMostVotes condition
// ---------------------------------------------------------------------------

describe('GET /api/elections/[id] — hasMostVotes tally condition', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Election Detail – Tally: hasMostVotes');
  });

  it('marks option with most votes as winner (hasMostVotes only)', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 7 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 3 },
        ],
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: null,
          reachesVotes: null,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    const a = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    const b = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    expect(a.winner).toBe(true);
    expect(b.winner).toBe(false);
  });

  it('marks tied options as co-winners', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 5 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 5 },
        ],
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: null,
          reachesVotes: null,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === true)).toBe(true);
  });

  it('marks no winners when all votes are zero', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 0 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 0 },
        ],
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: null,
          reachesVotes: null,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — tally with reachesPercentage condition
// ---------------------------------------------------------------------------

describe('GET /api/elections/[id] — reachesPercentage tally condition', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Election Detail – Tally: reachesPercentage');
  });

  it('winner only if strictly more than X% of total votes', async () => {
    const req = await makeUserReq();
    // Option A: 6/10 = 60% → wins with threshold 50%
    // Option B: 4/10 = 40% → loses
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 6 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 4 },
        ],
        _count: { ballots: 10 },
        winningConditions: {
          hasMostVotes: false,
          reachesPercentage: 50,
          reachesVotes: null,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    const a = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    const b = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    expect(a.winner).toBe(true);
    expect(b.winner).toBe(false);
  });

  it('does not win if exactly at the percentage threshold (must be strictly greater)', async () => {
    const req = await makeUserReq();
    // Option A: 5/10 = 50%, threshold = 50 → must be strictly > 50%, so does NOT win
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 5 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 5 },
        ],
        _count: { ballots: 10 },
        winningConditions: {
          hasMostVotes: false,
          reachesPercentage: 50,
          reachesVotes: null,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });

  it('no winner when percentage condition is combined with hasMostVotes and winner fails percentage', async () => {
    const req = await makeUserReq();
    // A has most votes (7) but only 70% > 80% threshold? 70% is not > 80%, so no winner
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 7 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 3 },
        ],
        _count: { ballots: 10 },
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: 80,
          reachesVotes: null,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — tally with reachesVotes condition
// ---------------------------------------------------------------------------

describe('GET /api/elections/[id] — reachesVotes tally condition', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Election Detail – Tally: reachesVotes');
  });

  it('winner if vote count meets threshold (hasMostVotes disabled)', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 10 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 3 },
        ],
        _count: { ballots: 13 },
        winningConditions: {
          hasMostVotes: false,
          reachesPercentage: null,
          reachesVotes: 5,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    const a = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    const b = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    // A has 10 >= 5 → wins; B has 3 < 5 → loses
    expect(a.winner).toBe(true);
    expect(b.winner).toBe(false);
  });

  it('both options win when both meet the votes threshold', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 8 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 6 },
        ],
        _count: { ballots: 14 },
        winningConditions: {
          hasMostVotes: false,
          reachesPercentage: null,
          reachesVotes: 5,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === true)).toBe(true);
  });

  it('no winner when neither option meets the votes threshold', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 2 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 1 },
        ],
        _count: { ballots: 3 },
        winningConditions: {
          hasMostVotes: false,
          reachesPercentage: null,
          reachesVotes: 5,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — tally with quorum condition
// ---------------------------------------------------------------------------

describe('GET /api/elections/[id] — quorum tally condition', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Election Detail – Tally: quorum');
  });

  it('no winners when quorum is not met', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 7 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 3 },
        ],
        _count: { ballots: 10 },
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: null,
          reachesVotes: null,
          quorum: 20,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    // 10 ballots < quorum of 20 → no winners
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });

  it('winners computed normally when quorum is exactly met', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 15 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 5 },
        ],
        _count: { ballots: 20 },
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: null,
          reachesVotes: null,
          quorum: 20,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    const a = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    const b = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    // 20 ballots >= quorum 20 → normal hasMostVotes logic
    expect(a.winner).toBe(true);
    expect(b.winner).toBe(false);
  });

  it('winners computed normally when quorum is exceeded', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 18 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 12 },
        ],
        _count: { ballots: 30 },
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: null,
          reachesVotes: null,
          quorum: 20,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    const a = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    expect(a.winner).toBe(true);
  });

  it('no winners even if option has most votes when quorum fails', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 1 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 0 },
        ],
        _count: { ballots: 1 },
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: null,
          reachesVotes: null,
          quorum: 10,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — combined conditions (AND logic)
// ---------------------------------------------------------------------------

describe('GET /api/elections/[id] — combined winning conditions (AND logic)', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Election Detail – Tally: Combined Conditions');
  });

  it('ALL conditions must be satisfied — fails if any one condition fails', async () => {
    const req = await makeUserReq();
    // A has most votes (7), 70% > 50%, but 7 < reachesVotes threshold of 10 → no win
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 7 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 3 },
        ],
        _count: { ballots: 10 },
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: 50,
          reachesVotes: 10,
          quorum: null,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });

  it('wins when ALL conditions are satisfied simultaneously', async () => {
    const req = await makeUserReq();
    // A: 15/20 = 75% > 50%, 15 >= 10, has most votes, quorum 20 met
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 15 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 5 },
        ],
        _count: { ballots: 20 },
        winningConditions: {
          hasMostVotes: true,
          reachesPercentage: 50,
          reachesVotes: 10,
          quorum: 20,
        },
      }),
    );
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));
    const a = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    const b = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    expect(a.winner).toBe(true);
    expect(b.winner).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — lazy tally computation with conditions
// ---------------------------------------------------------------------------

describe('GET /api/elections/[id] — lazy tally with winning conditions', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Elections');
    allure.story('Election Detail – Lazy Tally with Conditions');
  });

  it('applies winning conditions when computing tally lazily from ballots', async () => {
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      winningConditions: {
        hasMostVotes: true,
        reachesPercentage: null,
        reachesVotes: null,
        quorum: 5,
      },
      // vote_count null → needs lazy computation
    });

    // Only 2 ballots cast but quorum is 5 → no winners expected
    const ballot1 = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[0].id],
      election.max_choices,
    );
    const ballot2 = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[0].id],
      election.max_choices,
    );

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([
      { encrypted_ballot: ballot1 },
      { encrypted_ballot: ballot2 },
    ]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}, {}]);

    const req = await makeUserReq();
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));

    // 2 ballots < quorum of 5 → no winners
    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });

  it('applies reachesVotes condition during lazy tally computation', async () => {
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      winningConditions: {
        hasMostVotes: false,
        reachesPercentage: null,
        reachesVotes: 3,
        quorum: null,
      },
    });

    // 4 votes for A, 1 vote for B
    const ballots = [
      encryptBallot(election.public_key, [MOCK_ELECTION_CHOICES[0].id], election.max_choices),
      encryptBallot(election.public_key, [MOCK_ELECTION_CHOICES[0].id], election.max_choices),
      encryptBallot(election.public_key, [MOCK_ELECTION_CHOICES[0].id], election.max_choices),
      encryptBallot(election.public_key, [MOCK_ELECTION_CHOICES[0].id], election.max_choices),
      encryptBallot(election.public_key, [MOCK_ELECTION_CHOICES[1].id], election.max_choices),
    ].map((b) => ({ encrypted_ballot: b }));

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce(ballots);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}, {}]);

    const req = await makeUserReq();
    const { body } = await parseJson<any>(await GET(req, DETAIL_PARAMS));

    const a = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    const b = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    // A: 4 >= 3 → wins; B: 1 < 3 → loses
    expect(a.winner).toBe(true);
    expect(b.winner).toBe(false);
  });
});

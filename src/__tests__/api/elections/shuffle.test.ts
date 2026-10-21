import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { resetAvatarsMock } from '@/__tests__/helpers/avatars-mock';
import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { resetCampusMock } from '@/__tests__/helpers/campus-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_CHOICES,
  MOCK_ELECTION_ID,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { shuffleChoicesForUser } from '@/lib/utils/shuffle-choices';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
vi.mock('@/lib/cache', async () => {
  const { cacheMock } = await import('@/__tests__/helpers/cache-mock');
  return cacheMock;
});
vi.mock('@/lib/campus-api', async () => {
  const { campusMock } = await import('@/__tests__/helpers/campus-mock');
  return campusMock;
});
vi.mock('@/lib/encryption', () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));
vi.mock('@/lib/bypass', () => ({
  getElectionBypassForUser: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/avatars', async () => {
  const { avatarsMock } = await import('@/__tests__/helpers/avatars-mock');
  return avatarsMock;
});

import { GET as getBallots } from '@/app/api/elections/[id]/ballots/route';
import { GET as getDetail } from '@/app/api/elections/[id]/route';
import { GET as getList, POST as createElection } from '@/app/api/elections/route';

const DETAIL_PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

const FUTURE_OPEN = new Date(TEST_NOW + 3_600_000).toISOString();
const FUTURE_CLOSE = new Date(TEST_NOW + 7_200_000).toISOString();

const validBody = {
  title: 'Shuffle Test Election',
  opensAt: FUTURE_OPEN,
  closesAt: FUTURE_CLOSE,
  choices: ['Option A', 'Option B', 'Option C'],
};

async function makeUserReq(payload = USER_PAYLOAD) {
  const { access } = await makeTokenPair(payload);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token);
}

async function makeAdminReq(body: object, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

function makeCachedElection(overrides: Parameters<typeof makeElection>[0] = {}) {
  const e = makeElection(overrides);
  return {
    id: e.id,
    type: e.type,
    title: e.title,
    description: e.description,
    createdAt: e.created_at.toISOString(),
    opensAt: e.opens_at.toISOString(),
    closesAt: e.closes_at.toISOString(),
    restrictions: e.restrictions,
    minChoices: e.min_choices,
    maxChoices: e.max_choices,
    publicKey: e.public_key,
    privateKey: e.private_key,
    createdByFullName: e.created_by_full_name,
    approved: e.approved,
    approvedById: e.approved_by_id,
    approvedByFullName: e.approved_by_full_name,
    approvedAt: e.approved_at?.toISOString() ?? null,
    choices: e.choices.map((c) => ({ ...c, voteCount: c.vote_count ?? null })),
    ballotCount: 0,
    createdBy: e.created_by,
    deletedAt: null,
    deletedByUserId: null,
    deletedByName: null,
    winningConditions: e.winning_conditions as any,
    shuffleChoices: (overrides as any).shuffle_choices ?? false,
  };
}

// ---------------------------------------------------------------------------
// Unit tests for shuffleChoicesForUser utility
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
  resetCampusMock();
  resetAvatarsMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Shuffling election choices', () => {
  const choices = [
    { id: 'a', choice: 'A', position: 0 },
    { id: 'b', choice: 'B', position: 1 },
    { id: 'c', choice: 'C', position: 2 },
    { id: 'd', choice: 'D', position: 3 },
  ];

  it('should return all original choices (no additions or deletions) when shuffling election choices', () => {
    const result = shuffleChoicesForUser(choices, 'user-1', 'election-1');
    expect(result).toHaveLength(choices.length);
    const ids = result.map((c) => c.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should renumber choice positions from zero when shuffling election choices', () => {
    const result = shuffleChoicesForUser(choices, 'user-1', 'election-1');
    const positions = result.map((c) => c.position).sort((a, b) => a - b);
    expect(positions).toEqual([0, 1, 2, 3]);
    // Positions must match index in the returned array
    result.forEach((c, i) => expect(c.position).toBe(i));
  });

  it('should preserve the choice order when the voter and election are unchanged', () => {
    const r1 = shuffleChoicesForUser(choices, 'user-42', 'election-99');
    const r2 = shuffleChoicesForUser(choices, 'user-42', 'election-99');
    expect(r1.map((c) => c.id)).toEqual(r2.map((c) => c.id));
  });

  it('should produce different orderings for different users when shuffling election choices', () => {
    const orderA = shuffleChoicesForUser(choices, 'user-A', 'election-1').map((c) => c.id);
    const orderB = shuffleChoicesForUser(choices, 'user-B', 'election-1').map((c) => c.id);
    // Statistically almost certain to differ for 4+ choices with different seeds
    expect(orderA).not.toEqual(orderB);
  });

  it('should produce different orderings for the same user in different elections when shuffling election choices', () => {
    const order1 = shuffleChoicesForUser(choices, 'user-X', 'election-1').map((c) => c.id);
    const order2 = shuffleChoicesForUser(choices, 'user-X', 'election-2').map((c) => c.id);
    expect(order1).not.toEqual(order2);
  });

  it('should preserve the only choice when shuffling a single-choice election', () => {
    const single = [{ id: 'only', choice: 'Only', position: 0 }];
    const result = shuffleChoicesForUser(single, 'user-1', 'election-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('only');
    expect(result[0].position).toBe(0);
  });

  it('should not mutate the original array when shuffling election choices', () => {
    const original = choices.map((c) => ({ ...c }));
    shuffleChoicesForUser(choices, 'user-1', 'election-1');
    expect(choices).toEqual(original);
  });

  it('should preserve all properties of each choice object when shuffling election choices', () => {
    const richChoices = choices.map((c) => ({ ...c, votes: 5, winner: true }));
    const result = shuffleChoicesForUser(richChoices, 'user-1', 'election-1');
    result.forEach((c) => {
      expect(c.votes).toBe(5);
      expect(c.winner).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/elections — shuffleChoices field
// ---------------------------------------------------------------------------

describe('Creating an election — shuffleChoices (POST /api/elections)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Create Election – Shuffle Choices');
  });

  it('should create election with shuffleChoices: false by default when creating an election', async () => {
    const req = await makeAdminReq(validBody);
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection(),
      shuffle_choices: false,
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
      restrictions: [],
    });

    const { status, body } = await parseJson<any>(await createElection(req));
    expect(status).toBe(201);
    expect(body.shuffleChoices).toBe(false);
  });

  it('should create election with shuffleChoices: true when requested', async () => {
    const req = await makeAdminReq({ ...validBody, shuffleChoices: true });
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection({ shuffle_choices: true } as any),
      shuffle_choices: true,
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
      restrictions: [],
    });

    const { status, body } = await parseJson<any>(await createElection(req));
    expect(status).toBe(201);
    expect(body.shuffleChoices).toBe(true);
  });

  it('should pass shuffle_choices: true to prisma.election.create when creating an election', async () => {
    const req = await makeAdminReq({ ...validBody, shuffleChoices: true });
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection(),
      shuffle_choices: true,
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
      restrictions: [],
    });

    await createElection(req);

    const createCall = prismaMock.election.create.mock.calls[0][0];
    expect(createCall.data.shuffle_choices).toBe(true);
  });

  it('should pass shuffle_choices: false to prisma when not provided', async () => {
    const req = await makeAdminReq(validBody); // no shuffleChoices key
    prismaMock.election.create.mockResolvedValueOnce({
      ...makeElection(),
      shuffle_choices: false,
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
      restrictions: [],
    });

    await createElection(req);

    const createCall = prismaMock.election.create.mock.calls[0][0];
    expect(createCall.data.shuffle_choices).toBe(false);
  });

  it('should return shuffled choices in creation response when shuffleChoices: true', async () => {
    const req = await makeAdminReq({ ...validBody, shuffleChoices: true });
    const election = makeElection({ shuffle_choices: true } as any);
    prismaMock.election.create.mockResolvedValueOnce({
      ...election,
      shuffle_choices: true,
      opens_at: new Date(FUTURE_OPEN),
      closes_at: new Date(FUTURE_CLOSE),
      restrictions: [],
    });

    const { body } = await parseJson<any>(await createElection(req));

    // Positions must be re-assigned 0-based in shuffled order
    const positions = body.choices
      .map((c: any) => c.position)
      .sort((a: number, b: number) => a - b);
    expect(positions).toEqual(body.choices.map((_: any, i: number) => i));

    // All original choices must still be present
    const ids = body.choices.map((c: any) => c.id).sort();
    const originalIds = election.choices.map((c) => c.id).sort();
    expect(ids).toEqual(originalIds);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections — shuffleChoices in list response
// ---------------------------------------------------------------------------

describe('Listing elections — shuffleChoices (GET /api/elections)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('List Elections – Shuffle Choices');
  });

  async function makeAuthReq() {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
    return makeAuthRequest(access.token);
  }

  it('should include shuffleChoices: false when not enabled', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce([makeCachedElection()] as any);

    const { body } = await parseJson<any>(await getList(req));
    expect(body.elections[0].shuffleChoices).toBe(false);
  });

  it('should include shuffleChoices: true when enabled', async () => {
    const req = await makeAuthReq();
    cacheMock.getCachedElections.mockResolvedValueOnce([
      { ...makeCachedElection(), shuffleChoices: true },
    ] as any);

    const { body } = await parseJson<any>(await getList(req));
    expect(body.elections[0].shuffleChoices).toBe(true);
  });

  it('should shuffle choices for the requesting user when shuffleChoices is true', async () => {
    const req = await makeAuthReq();
    const cached = { ...makeCachedElection(), shuffleChoices: true };
    cacheMock.getCachedElections.mockResolvedValueOnce([cached] as any);

    const { body } = await parseJson<any>(await getList(req));
    const returnedIds = body.elections[0].choices.map((c: any) => c.id);
    const originalIds = cached.choices.map((c: any) => c.id);

    // All choices present
    expect(returnedIds.sort()).toEqual(originalIds.sort());
    // Positions reassigned as 0-based indices
    body.elections[0].choices.forEach((c: any, i: number) => expect(c.position).toBe(i));
  });

  it('should not shuffle choices when shuffleChoices is false', async () => {
    const req = await makeAuthReq();
    const cached = { ...makeCachedElection(), shuffleChoices: false };
    cacheMock.getCachedElections.mockResolvedValueOnce([cached] as any);

    const { body } = await parseJson<any>(await getList(req));
    // The returned choices order must match the cached order (sorted by original position)
    const returnedIds = body.elections[0].choices.map((c: any) => c.id);
    const originalIds = cached.choices.map((c: any) => c.id);
    expect(returnedIds).toEqual(originalIds);
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id] — shuffleChoices in detail response
// ---------------------------------------------------------------------------

describe('Viewing an election — shuffleChoices (GET /api/elections/[id])', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Election Detail – Shuffle Choices');
  });

  it('should return shuffleChoices: false on detail when not enabled', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());

    const { body } = await parseJson<any>(await getDetail(req, DETAIL_PARAMS));
    expect(body.shuffleChoices).toBe(false);
  });

  it('should return shuffleChoices: true on detail when enabled', async () => {
    const req = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ shuffle_choices: true } as any),
    );

    const { body } = await parseJson<any>(await getDetail(req, DETAIL_PARAMS));
    expect(body.shuffleChoices).toBe(true);
  });

  it('should shuffle choices for user when shuffleChoices is true', async () => {
    const req = await makeUserReq();
    const election = makeElection({ shuffle_choices: true } as any);
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const { body } = await parseJson<any>(await getDetail(req, DETAIL_PARAMS));

    // All choices present
    expect(body.choices.map((c: any) => c.id).sort()).toEqual(
      election.choices.map((c) => c.id).sort(),
    );
    // Positions are 0-based indices of shuffled order
    body.choices.forEach((c: any, i: number) => expect(c.position).toBe(i));
  });

  it('should preserve the voter choice order when the same voter requests the election again', async () => {
    const election = makeElection({ shuffle_choices: true } as any);

    const req1 = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const { body: body1 } = await parseJson<any>(await getDetail(req1, DETAIL_PARAMS));

    const req2 = await makeUserReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const { body: body2 } = await parseJson<any>(await getDetail(req2, DETAIL_PARAMS));

    expect(body1.choices.map((c: any) => c.id)).toEqual(body2.choices.map((c: any) => c.id));
  });

  it('should not shuffle choices when shuffleChoices is false', async () => {
    const req = await makeUserReq();
    const election = makeElection(); // shuffle_choices: false by default
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const { body } = await parseJson<any>(await getDetail(req, DETAIL_PARAMS));

    // Choices returned in original position order
    const returnedIds = body.choices.map((c: any) => c.id);
    const originalIds = [...election.choices]
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id);
    expect(returnedIds).toEqual(originalIds);
  });

  it('should shuffle choices for closed elections with tally data when viewing an election', async () => {
    const req = await makeUserReq();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      choices: [
        { ...MOCK_ELECTION_CHOICES[0], vote_count: 7 },
        { ...MOCK_ELECTION_CHOICES[1], vote_count: 3 },
      ],
      shuffle_choices: true,
    } as any);
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const { body } = await parseJson<any>(await getDetail(req, DETAIL_PARAMS));

    expect(body.shuffleChoices).toBe(true);
    // All choices present with vote data
    expect(body.choices).toHaveLength(2);
    body.choices.forEach((c: any) => {
      expect(typeof c.votes).toBe('number');
      expect(typeof c.winner).toBe('boolean');
    });
    // Positions are 0-based indices
    body.choices.forEach((c: any, i: number) => expect(c.position).toBe(i));
  });

  it('should read shuffleChoices from cache when available', async () => {
    const req = await makeUserReq();
    const cached = makeCachedElection({ shuffle_choices: true } as any);
    cacheMock.getCachedElections.mockResolvedValueOnce([
      { ...cached, shuffleChoices: true },
    ] as any);

    const { body } = await parseJson<any>(await getDetail(req, DETAIL_PARAMS));

    expect(body.shuffleChoices).toBe(true);
    expect(prismaMock.election.findUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/elections/[id]/ballots — shuffleChoices in ballots response
// ---------------------------------------------------------------------------

describe('Viewing election ballots — shuffleChoices (GET /api/elections/[id]/ballots)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Ballot Transparency – Shuffle Choices');
  });

  async function authReq() {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    return makeAuthRequest(access.token, {
      url: 'http://localhost/api/elections/1/ballots',
    });
  }

  it('should return shuffleChoices: false when not enabled', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);

    const { body } = await parseJson<any>(await getBallots(req, DETAIL_PARAMS));
    expect(body.election.shuffleChoices).toBe(false);
  });

  it('should return shuffleChoices: true when enabled', async () => {
    const req = await authReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({ shuffle_choices: true } as any),
    );
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);

    const { body } = await parseJson<any>(await getBallots(req, DETAIL_PARAMS));
    expect(body.election.shuffleChoices).toBe(true);
  });

  it('should shuffle choices in ballot response when shuffleChoices is true', async () => {
    const req = await authReq();
    const election = makeElection({ shuffle_choices: true } as any);
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);

    const { body } = await parseJson<any>(await getBallots(req, DETAIL_PARAMS));

    expect(body.election.choices.map((c: any) => c.id).sort()).toEqual(
      election.choices.map((c) => c.id).sort(),
    );
    body.election.choices.forEach((c: any, i: number) => expect(c.position).toBe(i));
  });

  it('should not shuffle choices in ballot response when disabled', async () => {
    const req = await authReq();
    const election = makeElection(); // shuffle_choices: false
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);

    const { body } = await parseJson<any>(await getBallots(req, DETAIL_PARAMS));

    const returnedIds = body.election.choices.map((c: any) => c.id);
    const originalIds = election.choices.map((c) => c.id);
    expect(returnedIds).toEqual(originalIds);
  });

  it('should read shuffleChoices from cache for ballots route when viewing election ballots', async () => {
    const req = await authReq();
    const cached = { ...makeCachedElection(), shuffleChoices: true };
    cacheMock.getCachedElections.mockResolvedValueOnce([cached] as any);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);

    const { body } = await parseJson<any>(await getBallots(req, DETAIL_PARAMS));

    expect(body.election.shuffleChoices).toBe(true);
    expect(prismaMock.election.findUnique).not.toHaveBeenCalled();
  });
});

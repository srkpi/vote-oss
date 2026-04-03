import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  encryptBallot,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_CHOICES,
  MOCK_ELECTION_ID,
  OTHER_FACULTY_PAYLOAD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);
jest.mock('@/lib/encryption', () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));
jest.mock('@/lib/bypass', () => ({
  getElectionBypassForUser: jest.fn().mockResolvedValue(null),
}));

import { GET } from '@/app/api/elections/[id]/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function authRequest(payload = USER_PAYLOAD) {
  const { access } = await makeTokenPair(payload);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token);
}

describe('GET /api/elections/[id]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();

    allure.feature('Elections');
    allure.story('Election Detail');
  });

  // ── Access control ────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-uuid id', async () => {
    const req = await authRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user faculty does not match restriction', async () => {
    const req = await authRequest(OTHER_FACULTY_PAYLOAD);
    const election = makeElection({
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user group does not match restriction', async () => {
    const req = await authRequest(USER_PAYLOAD); // group KV-91
    const election = makeElection({
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'GROUP', value: 'KV-99' },
      ],
    });
    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(403);
  });

  // ── Cache behaviour ───────────────────────────────────────────────────────

  describe('Caching', () => {
    it('returns 200 using cached election data if available', async () => {
      const req = await authRequest();
      const election = makeElection();

      cacheMock.getCachedElections.mockResolvedValueOnce([
        {
          id: election.id,
          title: election.title,
          createdAt: election.created_at.toISOString(),
          opensAt: election.opens_at.toISOString(),
          closesAt: election.closes_at.toISOString(),
          minChoices: election.min_choices,
          maxChoices: election.max_choices,
          restrictions: election.restrictions,
          publicKey: election.public_key,
          privateKey: election.private_key,
          creator: { fullName: election.creator.full_name, faculty: election.creator.faculty },
          choices: election.choices.map((c) => ({ ...c, voteCount: c.vote_count ?? null })),
          ballotCount: 0,
        },
      ] as any);

      const res = await GET(req, PARAMS);
      const { status, body } = await parseJson<any>(res);

      expect(status).toBe(200);
      expect(body.id).toBe(election.id);
      expect(prismaMock.election.findUnique).not.toHaveBeenCalled(); // DB is skipped entirely!
    });

    it('returns 404 if cached elections exist but the requested election is not in the cache', async () => {
      const req = await authRequest();
      cacheMock.getCachedElections.mockResolvedValueOnce([] as any); // Cache array exists, but is empty

      const res = await GET(req, PARAMS);
      expect(res.status).toBe(404);
      expect(prismaMock.election.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── Basic response shape ──────────────────────────────────────────────────

  it('returns 200 with full election data for eligible user', async () => {
    const req = await authRequest();
    const election = makeElection();
    prismaMock.election.findUnique.mockResolvedValueOnce(election);

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.id).toBe(election.id);
    expect(body.title).toBe(election.title);
    expect(body.choices).toHaveLength(2);
    expect(body.ballotCount).toBe(0);
  });

  it('does not expose private key while election is open', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.privateKey).toBeUndefined();
  });

  it('exposes private key after election closes', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 3 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 1 },
        ],
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.privateKey).toBeDefined();
    expect(body.privateKey).toMatch(/-----BEGIN PRIVATE KEY-----/);
  });

  // ── hasVoted ──────────────────────────────────────────────────────────────

  it('returns hasVoted false for an open election when no token has been issued', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBe(false);
  });

  it('returns hasVoted true for an open election when the user has an issued token', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
    prismaMock.issuedToken.findUnique.mockResolvedValueOnce({
      id: 'tok-1',
      election_id: MOCK_ELECTION_ID,
      user_id: USER_PAYLOAD.sub,
    });

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBe(true);
  });

  it('queries issuedToken with the correct election_id and user_id', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());

    await GET(req, PARAMS);

    expect(prismaMock.issuedToken.findUnique).toHaveBeenCalledWith({
      where: {
        election_id_user_id: {
          election_id: MOCK_ELECTION_ID,
          user_id: USER_PAYLOAD.sub,
        },
      },
    });
  });

  it('does not include hasVoted for an upcoming election', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() + 3_600_000),
        closes_at: new Date(Date.now() + 7_200_000),
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBeUndefined();
  });

  it('does not include hasVoted for a closed election', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 5 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 2 },
        ],
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);
    expect(body.hasVoted).toBeUndefined();
  });

  it('does not call issuedToken.findUnique for upcoming elections', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() + 3_600_000),
        closes_at: new Date(Date.now() + 7_200_000),
      }),
    );

    await GET(req, PARAMS);
    expect(prismaMock.issuedToken.findUnique).not.toHaveBeenCalled();
  });

  it('does not call issuedToken.findUnique for closed elections', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 1 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 0 },
        ],
      }),
    );

    await GET(req, PARAMS);
    expect(prismaMock.issuedToken.findUnique).not.toHaveBeenCalled();
  });

  // ── Results — pre-computed (vote_count already set) ───────────────────────

  it('returns pre-computed votes and winner embedded in choices when closed election choices have vote_count', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 7 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 3 },
        ],
      }),
    );

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.choices).toHaveLength(2);
    const optA = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    expect(optA.votes).toBe(7);
    expect(optA.winner).toBe(true);
    const optB = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    expect(optB.votes).toBe(3);
    expect(optB.winner).toBe(false);
    // Should NOT re-fetch ballots since tallies are already persisted
    expect(prismaMock.ballot.findMany).not.toHaveBeenCalled();
    // No separate results field
    expect(body.results).toBeUndefined();
  });

  it('marks all tied choices as winners', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 5 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 5 },
        ],
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);

    expect(body.choices.every((c: any) => c.winner === true)).toBe(true);
  });

  it('marks no winners when all votes are zero', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 0 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 0 },
        ],
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);

    expect(body.choices.every((c: any) => c.winner === false)).toBe(true);
  });

  it('does not include votes/winner in choices for open elections', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection()); // open by default

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);

    expect(body.results).toBeUndefined();
    expect(body.choices[0].votes).toBeUndefined();
    expect(body.choices[0].winner).toBeUndefined();
  });

  it('does not include votes/winner in choices for upcoming elections', async () => {
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() + 3_600_000),
        closes_at: new Date(Date.now() + 7_200_000),
      }),
    );

    const res = await GET(req, PARAMS);
    const { body } = await parseJson<any>(res);

    expect(body.results).toBeUndefined();
    expect(body.choices[0].votes).toBeUndefined();
    expect(body.choices[0].winner).toBeUndefined();
  });

  // ── Results — lazy computation (vote_count is null) ───────────────────────

  it('computes tallies from ballots when closed and vote_count is null', async () => {
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
      // vote_count null → needs computation
    });

    // Both choices have vote_count: null (default in makeElection)
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
    const ballot3 = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[1].id],
      election.max_choices,
    );

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([
      { encrypted_ballot: ballot1 },
      { encrypted_ballot: ballot2 },
      { encrypted_ballot: ballot3 },
    ]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}, {}]);

    const res = await GET(req, PARAMS);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    const optA = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[0].id);
    const optB = body.choices.find((c: any) => c.id === MOCK_ELECTION_CHOICES[1].id);
    expect(optA.votes).toBe(2);
    expect(optA.winner).toBe(true);
    expect(optB.votes).toBe(1);
    expect(optB.winner).toBe(false);
  });

  it('persists computed tallies via $transaction', async () => {
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}]);

    await GET(req, PARAMS);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // Transaction array should include electionChoice.update calls plus token/nullifier cleanup
    const txOps = prismaMock.$transaction.mock.calls[0][0];
    expect(Array.isArray(txOps)).toBe(true);
    // 2 choice updates + 1 issuedToken.deleteMany + 1 usedTokenNullifier.deleteMany
    expect(txOps).toHaveLength(4);
  });

  it('updates vote_count for each choice in the transaction', async () => {
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });

    const ballot = encryptBallot(
      election.public_key,
      [MOCK_ELECTION_CHOICES[0].id],
      election.max_choices,
    );

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([{ encrypted_ballot: ballot }]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}, {}]);

    await GET(req, PARAMS);

    // electionChoice.update should have been called for each choice
    expect(prismaMock.electionChoice.update).toHaveBeenCalledTimes(2);
    const calls = prismaMock.electionChoice.update.mock.calls;
    const choiceACall = calls.find(([args]: any) => args.where.id === MOCK_ELECTION_CHOICES[0].id);
    expect(choiceACall?.[0].data.vote_count).toBe(1);
    const choiceBCall = calls.find(([args]: any) => args.where.id === MOCK_ELECTION_CHOICES[1].id);
    expect(choiceBCall?.[0].data.vote_count).toBe(0);
  });

  it('deletes issued tokens after computing tallies', async () => {
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}]);

    await GET(req, PARAMS);

    expect(prismaMock.issuedToken.deleteMany).toHaveBeenCalledWith({
      where: { election_id: MOCK_ELECTION_ID },
    });
  });

  it('deletes nullifiers after computing tallies', async () => {
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}]);

    await GET(req, PARAMS);

    expect(prismaMock.usedTokenNullifier.deleteMany).toHaveBeenCalledWith({
      where: { election_id: MOCK_ELECTION_ID },
    });
  });

  it('invalidates elections cache after computing tallies', async () => {
    const { invalidateElections } = jest.requireMock('@/lib/cache');
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}]);

    await GET(req, PARAMS);

    expect(invalidateElections).toHaveBeenCalledTimes(1);
  });

  it('does NOT invalidate cache when tallies are already persisted', async () => {
    const { invalidateElections } = jest.requireMock('@/lib/cache');
    const req = await authRequest();
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        opens_at: new Date(Date.now() - 7_200_000),
        closes_at: new Date(Date.now() - 100),
        choices: [
          { ...MOCK_ELECTION_CHOICES[0], vote_count: 5 },
          { ...MOCK_ELECTION_CHOICES[1], vote_count: 2 },
        ],
      }),
    );

    await GET(req, PARAMS);

    expect(invalidateElections).not.toHaveBeenCalled();
  });

  it('skips malformed ballots gracefully during tally computation', async () => {
    const req = await authRequest();
    const election = makeElection({
      opens_at: new Date(Date.now() - 7_200_000),
      closes_at: new Date(Date.now() - 100),
    });

    prismaMock.election.findUnique.mockResolvedValueOnce(election);
    prismaMock.ballot.findMany.mockResolvedValueOnce([
      { encrypted_ballot: 'bm90LXZhbGlkLWpzb24=' }, // base64("not-valid-json")
    ]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}, {}]);

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    spy.mockRestore();
  });
});

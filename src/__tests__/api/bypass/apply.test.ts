import * as allure from 'allure-js-commons';

import {
  JWT_TOKEN_RECORD,
  makeTokenPair,
  MOCK_ELECTION_ID,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/redis', () => ({
  redis: { del: jest.fn().mockResolvedValue(1), get: jest.fn().mockResolvedValue(null) },
  safeRedis: jest.fn().mockImplementation((fn: () => unknown) => {
    try {
      return fn();
    } catch {
      return null;
    }
  }),
}));

import { POST } from '@/app/api/bypass/apply/route';

async function authReq(body: object = {}) {
  const { access } = await makeTokenPair(USER_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

const VALID_TOKEN = 'some-raw-bypass-token-value';

function makeGlobalTokenRecord(
  overrides: Partial<{
    valid_until: Date;
    max_usage: number;
    current_usage: number;
  }> = {},
) {
  return {
    token_hash: 'hashed',
    bypass_not_studying: true,
    bypass_graduate: false,
    max_usage: 5,
    current_usage: 0,
    valid_until: new Date(Date.now() + 86_400_000),
    created_at: new Date(),
    created_by: 'superadmin-001',
    ...overrides,
  };
}

function makeElectionTokenRecord(
  overrides: Partial<{
    max_usage: number;
    current_usage: number;
  }> = {},
) {
  const now = Date.now();
  return {
    token_hash: 'hashed',
    election_id: MOCK_ELECTION_ID,
    bypass_restrictions: ['FACULTY'],
    max_usage: 5,
    current_usage: 0,
    created_at: new Date(),
    created_by: 'superadmin-001',
    election: {
      closes_at: new Date(now + 3_600_000),
      deleted_at: null,
    },
    ...overrides,
  };
}

describe('POST /api/bypass/apply', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Bypass');
    allure.story('Apply Bypass Token');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST', body: { token: VALID_TOKEN } });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when token field is missing', async () => {
    const req = await authReq({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when token does not exist in either table', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    // globalBypassToken.findUnique returns null (default)
    // electionBypassToken.findUnique returns null (default)
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  // ── Global token tests ───────────────────────────────────────────────────

  it('returns 400 when global token is expired', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(
      makeGlobalTokenRecord({ valid_until: new Date(Date.now() - 1000) }),
    );
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/expired/i);
  });

  it('returns 400 when global token has reached max_usage limit', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(
      makeGlobalTokenRecord({ max_usage: 5, current_usage: 5 }),
    );
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/usage limit/i);
  });

  it('increments current_usage via $transaction on first global token activation', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(makeGlobalTokenRecord());
    prismaMock.globalBypassTokenUsage.findUnique.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    await POST(req);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const txOps = prismaMock.$transaction.mock.calls[0][0];
    expect(Array.isArray(txOps)).toBe(true);
    expect(txOps).toHaveLength(2); // usage create + token increment
  });

  it('does NOT call $transaction on idempotent re-activation of global token', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(makeGlobalTokenRecord());
    prismaMock.globalBypassTokenUsage.findUnique.mockResolvedValueOnce({
      id: 'usage-1',
      token_hash: 'hashed',
      user_id: USER_PAYLOAD.sub,
      used_at: new Date(),
      revoked_at: null,
    });

    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(200);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 when prior global usage exists but is revoked', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(makeGlobalTokenRecord());
    prismaMock.globalBypassTokenUsage.findUnique.mockResolvedValueOnce({
      id: 'usage-1',
      token_hash: 'hashed',
      user_id: USER_PAYLOAD.sub,
      used_at: new Date(),
      revoked_at: new Date(),
    });

    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/revoked/i);
  });

  it('returns GLOBAL type and null electionId for global token', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(makeGlobalTokenRecord());
    prismaMock.globalBypassTokenUsage.findUnique.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const { body } = await parseJson<any>(await POST(req));
    expect(body.type).toBe('GLOBAL');
    expect(body.electionId).toBeNull();
  });

  // ── Election token tests ─────────────────────────────────────────────────

  it('falls through to election token when global token not found', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    // globalBypassToken returns null (default)
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(makeElectionTokenRecord());
    prismaMock.electionBypassTokenUsage.findUnique.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(200);
    expect(body.type).toBe('ELECTION');
    expect(body.electionId).toBe(MOCK_ELECTION_ID);
  });

  it('returns 400 when election has already closed', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    const record = makeElectionTokenRecord();
    record.election.closes_at = new Date(Date.now() - 1000);
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(record);

    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/closed/i);
  });

  it('returns 400 when election token has reached max_usage limit', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionTokenRecord({ max_usage: 3, current_usage: 3 }),
    );
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/usage limit/i);
  });

  it('increments current_usage via $transaction on first election token activation', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(makeElectionTokenRecord());
    prismaMock.electionBypassTokenUsage.findUnique.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    await POST(req);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const txOps = prismaMock.$transaction.mock.calls[0][0];
    expect(Array.isArray(txOps)).toBe(true);
    expect(txOps).toHaveLength(2);
  });

  it('does NOT call $transaction on idempotent re-activation of election token', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(makeElectionTokenRecord());
    prismaMock.electionBypassTokenUsage.findUnique.mockResolvedValueOnce({
      id: 'usage-1',
      token_hash: 'hashed',
      user_id: USER_PAYLOAD.sub,
      used_at: new Date(),
      revoked_at: null,
    });

    const { status } = await parseJson<any>(await POST(req));
    expect(status).toBe(200);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 when prior election usage exists but is revoked', async () => {
    const req = await authReq({ token: VALID_TOKEN });
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(makeElectionTokenRecord());
    prismaMock.electionBypassTokenUsage.findUnique.mockResolvedValueOnce({
      id: 'usage-1',
      token_hash: 'hashed',
      user_id: USER_PAYLOAD.sub,
      used_at: new Date(),
      revoked_at: new Date(),
    });

    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/revoked/i);
  });
});

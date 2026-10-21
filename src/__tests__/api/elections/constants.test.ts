import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { campusMock, resetCampusMock } from '@/__tests__/helpers/campus-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  makeElection,
  makeTokenPair,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_MAX_CLOSES_AT_DAYS,
  ELECTION_TITLE_MAX_LENGTH,
} from '@/lib/constants';

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

import { POST } from '@/app/api/elections/route';

const now = TEST_NOW;
const FUTURE_OPEN = new Date(TEST_NOW + 3_600_000).toISOString();
const FUTURE_CLOSE = new Date(TEST_NOW + 7_200_000).toISOString();

const validBody = {
  title: 'Valid Election Title',
  opensAt: FUTURE_OPEN,
  closesAt: FUTURE_CLOSE,
  choices: ['Option A', 'Option B'],
};

async function makeAdminReq(body: unknown, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
  resetCampusMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Creating an election — constant-driven validation (POST /api/elections)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Create Election – Constants Validation');
  });

  it.each([null, [], 'election', 42, true])(
    'should reject a non-object body: %j when creating an election',
    async (body) => {
      const response = await POST(await makeAdminReq(body));
      expect(response.status).toBe(400);
      expect(prismaMock.election.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { title: 123 },
    { description: {} },
    { opensAt: 123 },
    { closesAt: [] },
    { choices: 'Option A' },
    { choices: ['Option A', null] },
    { choices: ['Option A', 123] },
    { minChoices: '1' },
    { minChoices: 1.5 },
    { maxChoices: 1.5 },
    { restrictions: {} },
    { restrictions: [null] },
    { restrictions: [{ type: 'FACULTY', value: 123 }] },
    { restrictions: [{ value: 'FICE' }] },
    { shuffleChoices: 'false' },
    { publicViewing: 1 },
    { anonymous: 'true' },
  ])('should reject malformed election fields: %j when creating an election', async (fields) => {
    const response = await POST(await makeAdminReq({ ...validBody, ...fields }));
    expect(response.status).toBe(400);
    expect(prismaMock.election.create).not.toHaveBeenCalled();
    expect(campusMock.fetchFacultyGroups).not.toHaveBeenCalled();
  });

  it('should ignore election-only fields when a regular user creates a petition', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
    prismaMock.election.create.mockResolvedValueOnce(makeElection({ type: 'PETITION' }));

    const response = await POST(
      makeAuthRequest(access.token, {
        method: 'POST',
        body: {
          type: 'ELECTION',
          title: 'Petition title',
          description: 'Petition description',
          choices: 'ignored',
          restrictions: [null],
          anonymous: 'ignored',
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(prismaMock.election.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'PETITION', anonymous: false }),
      }),
    );
  });

  it('should validate petition field types for admins too when creating an election', async () => {
    const response = await POST(
      await makeAdminReq({ type: 'PETITION', title: 'Petition title', description: {} }),
    );
    expect(response.status).toBe(400);
    expect(prismaMock.election.create).not.toHaveBeenCalled();
  });

  // ── Title length ────────────────────────────────────────────────────────

  describe('when validating election title length', () => {
    it(`accepts a title exactly ${ELECTION_TITLE_MAX_LENGTH} characters long`, async () => {
      const title = 'A'.repeat(ELECTION_TITLE_MAX_LENGTH);
      const req = await makeAdminReq({ ...validBody, title });
      prismaMock.election.create.mockResolvedValueOnce({
        id: 'uuid-1',
        title,
        opens_at: new Date(FUTURE_OPEN),
        closes_at: new Date(FUTURE_CLOSE),
        public_key: 'pk',
        private_key: 'sk',
        choices: [],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it(`returns 400 when title is ${ELECTION_TITLE_MAX_LENGTH + 1} characters`, async () => {
      const title = 'A'.repeat(ELECTION_TITLE_MAX_LENGTH + 1);
      const req = await makeAdminReq({ ...validBody, title });
      const { status } = await parseJson(await POST(req));
      expect(status).toBe(400);
    });

    it('should return 400 when title is empty', async () => {
      const req = await makeAdminReq({ ...validBody, title: '' });
      const { status } = await parseJson(await POST(req));
      expect(status).toBe(400);
    });
  });

  // ── Choices count ────────────────────────────────────────────────────────

  describe('when validating the number of choices', () => {
    it(`accepts exactly ${ELECTION_CHOICES_MIN} choices`, async () => {
      const choices = Array.from({ length: ELECTION_CHOICES_MIN }, (_, i) => `Choice ${i + 1}`);
      const req = await makeAdminReq({ ...validBody, choices });
      prismaMock.election.create.mockResolvedValueOnce({
        id: 'uuid-2',
        title: validBody.title,
        opens_at: new Date(FUTURE_OPEN),
        closes_at: new Date(FUTURE_CLOSE),
        public_key: 'pk',
        private_key: 'sk',
        choices: [],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it(`accepts exactly ${ELECTION_CHOICES_MAX} choices`, async () => {
      const choices = Array.from({ length: ELECTION_CHOICES_MAX }, (_, i) => `Choice ${i + 1}`);
      const req = await makeAdminReq({ ...validBody, choices });
      prismaMock.election.create.mockResolvedValueOnce({
        id: 'uuid-3',
        title: validBody.title,
        opens_at: new Date(FUTURE_OPEN),
        closes_at: new Date(FUTURE_CLOSE),
        public_key: 'pk',
        private_key: 'sk',
        choices: [],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it(`returns 400 with fewer than ${ELECTION_CHOICES_MIN} choices`, async () => {
      const choices = Array.from({ length: ELECTION_CHOICES_MIN - 1 }, (_, i) => `Choice ${i + 1}`);
      const req = await makeAdminReq({ ...validBody, choices });
      const { status } = await parseJson(await POST(req));
      expect(status).toBe(400);
    });

    it(`returns 400 with more than ${ELECTION_CHOICES_MAX} choices`, async () => {
      const choices = Array.from({ length: ELECTION_CHOICES_MAX + 1 }, (_, i) => `Choice ${i + 1}`);
      const req = await makeAdminReq({ ...validBody, choices });
      const { status } = await parseJson(await POST(req));
      expect(status).toBe(400);
    });
  });

  // ── Choice text length ───────────────────────────────────────────────────

  describe('when validating choice text length', () => {
    it(`accepts a choice text exactly ${ELECTION_CHOICE_MAX_LENGTH} characters long`, async () => {
      const choices = ['A'.repeat(ELECTION_CHOICE_MAX_LENGTH), 'Option B'];
      const req = await makeAdminReq({ ...validBody, choices });
      prismaMock.election.create.mockResolvedValueOnce({
        id: 'uuid-4',
        title: validBody.title,
        opens_at: new Date(FUTURE_OPEN),
        closes_at: new Date(FUTURE_CLOSE),
        public_key: 'pk',
        private_key: 'sk',
        choices: [],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it(`returns 400 when any choice text exceeds ${ELECTION_CHOICE_MAX_LENGTH} characters`, async () => {
      const choices = ['A'.repeat(ELECTION_CHOICE_MAX_LENGTH + 1), 'Option B'];
      const req = await makeAdminReq({ ...validBody, choices });
      const { status } = await parseJson(await POST(req));
      expect(status).toBe(400);
    });

    it('should return 400 when a non-first choice exceeds the length limit', async () => {
      const choices = ['Option A', 'B'.repeat(ELECTION_CHOICE_MAX_LENGTH + 1)];
      const req = await makeAdminReq({ ...validBody, choices });
      const { status } = await parseJson(await POST(req));
      expect(status).toBe(400);
    });
  });

  // ── Error message content ────────────────────────────────────────────────

  describe('when reporting validation limits', () => {
    it('should include the max length in the error message for a too-long title when creating an election', async () => {
      const req = await makeAdminReq({
        ...validBody,
        title: 'X'.repeat(ELECTION_TITLE_MAX_LENGTH + 1),
      });
      const { body } = await parseJson<any>(await POST(req));
      expect(body.message).toMatch(new RegExp(String(ELECTION_TITLE_MAX_LENGTH)));
    });

    it('should include the max count in the error message for too many choices when creating an election', async () => {
      const choices = Array.from({ length: ELECTION_CHOICES_MAX + 1 }, (_, i) => `C${i}`);
      const req = await makeAdminReq({ ...validBody, choices });
      const { body } = await parseJson<any>(await POST(req));
      expect(body.message).toMatch(new RegExp(String(ELECTION_CHOICES_MAX)));
    });

    it('should include the max length in the error message for a too-long choice text when creating an election', async () => {
      const choices = ['A'.repeat(ELECTION_CHOICE_MAX_LENGTH + 1), 'Option B'];
      const req = await makeAdminReq({ ...validBody, choices });
      const { body } = await parseJson<any>(await POST(req));
      expect(body.message).toMatch(new RegExp(String(ELECTION_CHOICE_MAX_LENGTH)));
    });

    it('should return 400 when opensAt is invalid', async () => {
      const req = await makeAdminReq({ ...validBody, opensAt: 'not-a-date' });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/Invalid opensAt date/);
    });

    it('should return 400 when closesAt is invalid', async () => {
      const req = await makeAdminReq({ ...validBody, closesAt: 'not-a-date' });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/Invalid closesAt date/);
    });

    it('should return 400 when closesAt is before opensAt', async () => {
      const opensAt = new Date(now + 10_000).toISOString();
      const closesAt = new Date(now + 5_000).toISOString(); // before opensAt
      const req = await makeAdminReq({ ...validBody, opensAt, closesAt });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/closesAt must be after opensAt/);
    });

    it('should return 400 when closesAt exceeds max allowed days', async () => {
      const closesAt = new Date(
        now + (ELECTION_MAX_CLOSES_AT_DAYS + 1) * 24 * 60 * 60 * 1000,
      ).toISOString();
      const req = await makeAdminReq({ ...validBody, closesAt });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(
        new RegExp(`closesAt must be no more than ${ELECTION_MAX_CLOSES_AT_DAYS} days`),
      );
    });

    it('should accept valid opensAt and closesAt within allowed range when creating an election', async () => {
      const opensAt = new Date(now + 1_000_000).toISOString();
      const closesAt = new Date(now + 2_000_000).toISOString();
      const req = await makeAdminReq({ ...validBody, opensAt, closesAt });
      prismaMock.election.create.mockResolvedValueOnce({
        id: 'uuid-valid-dates',
        title: validBody.title,
        opens_at: new Date(opensAt),
        closes_at: new Date(closesAt),
        public_key: 'pk',
        private_key: 'sk',
        choices: [],
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });
  });
});

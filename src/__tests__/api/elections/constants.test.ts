import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import { campusMock, resetCampusMock } from '@/__tests__/helpers/campus-mock';
import { ADMIN_PAYLOAD, ADMIN_RECORD, makeTokenPair } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_MAX_CLOSES_AT_DAYS,
  ELECTION_TITLE_MAX_LENGTH,
} from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);
jest.mock('@/lib/campus-api', () => campusMock);
jest.mock('@/lib/encryption', () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));

import { POST } from '@/app/api/elections/route';

const now = Date.now();
const FUTURE_OPEN = new Date(Date.now() + 3_600_000).toISOString();
const FUTURE_CLOSE = new Date(Date.now() + 7_200_000).toISOString();

const validBody = {
  title: 'Valid Election Title',
  opensAt: FUTURE_OPEN,
  closesAt: FUTURE_CLOSE,
  choices: ['Option A', 'Option B'],
};

async function makeAdminReq(body: object, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

describe('POST /api/elections — constant-driven validation', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    resetCampusMock();
    allure.feature('Elections');
    allure.story('Create Election – Constants Validation');
  });

  // ── Title length ────────────────────────────────────────────────────────

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

  it('returns 400 when title is empty', async () => {
    const req = await makeAdminReq({ ...validBody, title: '' });
    const { status } = await parseJson(await POST(req));
    expect(status).toBe(400);
  });

  // ── Choices count ────────────────────────────────────────────────────────

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

  // ── Choice text length ───────────────────────────────────────────────────

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

  it('returns 400 when a non-first choice exceeds the length limit', async () => {
    const choices = ['Option A', 'B'.repeat(ELECTION_CHOICE_MAX_LENGTH + 1)];
    const req = await makeAdminReq({ ...validBody, choices });
    const { status } = await parseJson(await POST(req));
    expect(status).toBe(400);
  });

  // ── Error message content ────────────────────────────────────────────────

  it('includes the max length in the error message for a too-long title', async () => {
    const req = await makeAdminReq({
      ...validBody,
      title: 'X'.repeat(ELECTION_TITLE_MAX_LENGTH + 1),
    });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(new RegExp(String(ELECTION_TITLE_MAX_LENGTH)));
  });

  it('includes the max count in the error message for too many choices', async () => {
    const choices = Array.from({ length: ELECTION_CHOICES_MAX + 1 }, (_, i) => `C${i}`);
    const req = await makeAdminReq({ ...validBody, choices });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(new RegExp(String(ELECTION_CHOICES_MAX)));
  });

  it('includes the max length in the error message for a too-long choice text', async () => {
    const choices = ['A'.repeat(ELECTION_CHOICE_MAX_LENGTH + 1), 'Option B'];
    const req = await makeAdminReq({ ...validBody, choices });
    const { body } = await parseJson<any>(await POST(req));
    expect(body.message).toMatch(new RegExp(String(ELECTION_CHOICE_MAX_LENGTH)));
  });

  it('returns 400 if opensAt is invalid', async () => {
    const req = await makeAdminReq({ ...validBody, opensAt: 'not-a-date' });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/Invalid date format/);
  });

  it('returns 400 if closesAt is invalid', async () => {
    const req = await makeAdminReq({ ...validBody, closesAt: 'not-a-date' });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/Invalid date format/);
  });

  it('returns 400 if closesAt is before opensAt', async () => {
    const opensAt = new Date(now + 10_000).toISOString();
    const closesAt = new Date(now + 5_000).toISOString(); // before opensAt
    const req = await makeAdminReq({ ...validBody, opensAt, closesAt });
    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(400);
    expect(body.message).toMatch(/closesAt must be after opensAt/);
  });

  it('returns 400 if closesAt exceeds max allowed days', async () => {
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

  it('accepts valid opensAt and closesAt within allowed range', async () => {
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

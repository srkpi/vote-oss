import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { GET, POST } from '@/app/api/faq/route';

/** Minimal valid Quill Delta JSON string. */
function makeQuillContent(text: string): string {
  return JSON.stringify({ ops: [{ insert: text + '\n' }] });
}

async function unrestrictedAdminReq(body?: object) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: body !== undefined ? 'POST' : 'GET', body });
}

async function restrictedAdminReq(body?: object) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

describe('GET /api/faq', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Public FAQ list');
  });

  it('returns 200 with empty array when no categories exist', async () => {
    prismaMock.faqCategory.findMany.mockResolvedValueOnce([]);
    const { status, body } = await parseJson<unknown[]>(await GET());
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns categories with nested items ordered by position', async () => {
    prismaMock.faqCategory.findMany.mockResolvedValueOnce([
      {
        id: 'cat-1',
        title: 'General',
        position: 0,
        items: [
          {
            id: 'item-1',
            title: 'Q1',
            content: makeQuillContent('A1'),
            position: 0,
          },
          {
            id: 'item-2',
            title: 'Q2',
            content: makeQuillContent('A2'),
            position: 1,
          },
        ],
      },
    ]);

    const { status, body } = await parseJson<any[]>(await GET());

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('General');
    expect(body[0].items).toHaveLength(2);
  });

  it('does not require authentication', async () => {
    prismaMock.faqCategory.findMany.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    // No auth headers needed — no jwtToken or admin lookup should occur
    expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.admin.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/faq (create category)', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Create FAQ category');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST', body: { title: 'Test' } });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by a restricted user', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST', body: { title: 'Test' } });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin is not a root admin (has promoted_by)', async () => {
    const req = await restrictedAdminReq({ title: 'Test' });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it('returns 400 when title is missing', async () => {
    const req = await unrestrictedAdminReq({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when title is empty string', async () => {
    const req = await unrestrictedAdminReq({ title: '   ' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it(`returns 400 when title exceeds ${FAQ_CATEGORY_TITLE_MAX_LENGTH} characters`, async () => {
    const req = await unrestrictedAdminReq({
      title: 'A'.repeat(FAQ_CATEGORY_TITLE_MAX_LENGTH + 1),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it(`accepts title exactly ${FAQ_CATEGORY_TITLE_MAX_LENGTH} characters long`, async () => {
    const req = await unrestrictedAdminReq({ title: 'A'.repeat(FAQ_CATEGORY_TITLE_MAX_LENGTH) });
    prismaMock.faqCategory.findFirst.mockResolvedValueOnce(null);
    prismaMock.faqCategory.create.mockResolvedValueOnce({
      id: 'cat-1',
      title: 'A'.repeat(FAQ_CATEGORY_TITLE_MAX_LENGTH),
      position: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  // ── Success path ──────────────────────────────────────────────────────────

  it('returns 201 with category data on success', async () => {
    const req = await unrestrictedAdminReq({ title: 'General' });
    prismaMock.faqCategory.findFirst.mockResolvedValueOnce(null); // no existing categories
    prismaMock.faqCategory.create.mockResolvedValueOnce({
      id: 'cat-1',
      title: 'General',
      position: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const { status, body } = await parseJson<any>(await POST(req));
    expect(status).toBe(201);
    expect(body.title).toBe('General');
    expect(body.position).toBe(0);
  });

  it('appends new category after the last one (position = last.position + 1)', async () => {
    const req = await unrestrictedAdminReq({ title: 'New Cat' });
    prismaMock.faqCategory.findFirst.mockResolvedValueOnce({ position: 3 }); // last has position 3
    prismaMock.faqCategory.create.mockResolvedValueOnce({
      id: 'cat-5',
      title: 'New Cat',
      position: 4,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await POST(req);

    expect(prismaMock.faqCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 4 }),
      }),
    );
  });

  it('stores created_by from the authenticated user', async () => {
    const req = await unrestrictedAdminReq({ title: 'Security' });
    prismaMock.faqCategory.findFirst.mockResolvedValueOnce(null);
    prismaMock.faqCategory.create.mockResolvedValueOnce({
      id: 'cat-2',
      title: 'Security',
      position: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await POST(req);

    expect(prismaMock.faqCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ created_by: 'superadmin-001' }),
      }),
    );
  });

  it('trims whitespace from title before saving', async () => {
    const req = await unrestrictedAdminReq({ title: '  General  ' });
    prismaMock.faqCategory.findFirst.mockResolvedValueOnce(null);
    prismaMock.faqCategory.create.mockResolvedValueOnce({
      id: 'cat-1',
      title: 'General',
      position: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await POST(req);

    expect(prismaMock.faqCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'General' }),
      }),
    );
  });
});

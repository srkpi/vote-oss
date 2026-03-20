import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_RECORD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import {
  FAQ_CATEGORY_TITLE_MAX_LENGTH,
  FAQ_ITEM_CONTENT_MAX_LENGTH,
  FAQ_ITEM_TITLE_MAX_LENGTH,
} from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { PATCH as reorderItems } from '@/app/api/faq/categories/[id]/items/reorder/route';
import { POST as postItem } from '@/app/api/faq/categories/[id]/items/route';
import { DELETE as deleteCategory, PUT as putCategory } from '@/app/api/faq/categories/[id]/route';
import { PATCH as reorderCategories } from '@/app/api/faq/categories/reorder/route';
import { DELETE as deleteItem, PUT as putItem } from '@/app/api/faq/items/[id]/route';

// ---------------------------------------------------------------------------
// Quill Delta content helpers
// ---------------------------------------------------------------------------

function makeQuillContent(text: string): string {
  return JSON.stringify({ ops: [{ insert: text + '\n' }] });
}

const VALID_CONTENT = makeQuillContent('Click vote.');

const OVER_LIMIT_CONTENT = makeQuillContent('X'.repeat(FAQ_ITEM_CONTENT_MAX_LENGTH + 1));

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function unrestrictedAdminReq(method: string, body?: object) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
  return makeAuthRequest(access.token, { method, body });
}

async function restrictedAdminReq(method: string, body?: object) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
  return makeAuthRequest(access.token, { method, body });
}

const catParams = (id: string) => ({ params: Promise.resolve({ id }) });
const itemParams = (id: string) => ({ params: Promise.resolve({ id }) });

// ===========================================================================
// PUT /api/faq/categories/[id]
// ===========================================================================

describe('PUT /api/faq/categories/[id]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Update FAQ category');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'PUT', body: { title: 'Updated' } });
    const res = await putCategory(req, catParams('cat-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when restricted admin', async () => {
    const req = await restrictedAdminReq('PUT', { title: 'Updated' });
    const res = await putCategory(req, catParams('cat-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when category does not exist', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'Updated' });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce(null);
    const res = await putCategory(req, catParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when title is missing', async () => {
    const req = await unrestrictedAdminReq('PUT', {});
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', title: 'Old' });
    const res = await putCategory(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it(`returns 400 when title exceeds ${FAQ_CATEGORY_TITLE_MAX_LENGTH} characters`, async () => {
    const req = await unrestrictedAdminReq('PUT', {
      title: 'X'.repeat(FAQ_CATEGORY_TITLE_MAX_LENGTH + 1),
    });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', title: 'Old' });
    const res = await putCategory(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 with updated category on success', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'Updated Title' });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', title: 'Old' });
    prismaMock.faqCategory.update.mockResolvedValueOnce({
      id: 'cat-1',
      title: 'Updated Title',
      position: 0,
      updated_at: new Date(),
    });

    const { status, body } = await parseJson<any>(await putCategory(req, catParams('cat-1')));
    expect(status).toBe(200);
    expect(body.title).toBe('Updated Title');
    expect(body.updatedAt).toBeDefined();
  });

  it('stores updated_by from authenticated user', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'New' });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', title: 'Old' });
    prismaMock.faqCategory.update.mockResolvedValueOnce({
      id: 'cat-1',
      title: 'New',
      position: 0,
      updated_at: new Date(),
    });

    await putCategory(req, catParams('cat-1'));

    expect(prismaMock.faqCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ updated_by: 'superadmin-001' }),
      }),
    );
  });

  it('invalidates the FAQ cache after updating a category', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'New' });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', title: 'Old' });
    prismaMock.faqCategory.update.mockResolvedValueOnce({
      id: 'cat-1',
      title: 'New',
      position: 0,
      updated_at: new Date(),
    });

    await putCategory(req, catParams('cat-1'));

    expect(cacheMock.invalidateFaq).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate the cache when validation fails', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: '' });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', title: 'Old' });
    await putCategory(req, catParams('cat-1'));
    expect(cacheMock.invalidateFaq).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// DELETE /api/faq/categories/[id]
// ===========================================================================

describe('DELETE /api/faq/categories/[id]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Delete FAQ category');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await deleteCategory(req, catParams('cat-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when restricted admin', async () => {
    const req = await restrictedAdminReq('DELETE');
    const res = await deleteCategory(req, catParams('cat-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when category does not exist', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce(null);
    const res = await deleteCategory(req, catParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with deletedId on success', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqCategory.delete.mockResolvedValueOnce({ id: 'cat-1' });

    const { status, body } = await parseJson<any>(await deleteCategory(req, catParams('cat-1')));
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deletedId).toBe('cat-1');
  });

  it('calls prisma.faqCategory.delete with the correct id', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-99' });
    prismaMock.faqCategory.delete.mockResolvedValueOnce({ id: 'cat-99' });

    await deleteCategory(req, catParams('cat-99'));

    expect(prismaMock.faqCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-99' } });
  });

  it('invalidates the FAQ cache after deleting a category', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqCategory.delete.mockResolvedValueOnce({ id: 'cat-1' });

    await deleteCategory(req, catParams('cat-1'));

    expect(cacheMock.invalidateFaq).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// POST /api/faq/categories/[id]/items
// ===========================================================================

describe('POST /api/faq/categories/[id]/items', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Create FAQ item');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST', body: { title: 'Q', content: VALID_CONTENT } });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when restricted admin', async () => {
    const req = await restrictedAdminReq('POST', { title: 'Q', content: VALID_CONTENT });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when category does not exist', async () => {
    const req = await unrestrictedAdminReq('POST', { title: 'Q', content: VALID_CONTENT });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce(null);
    const res = await postItem(req, catParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when title is missing', async () => {
    const req = await unrestrictedAdminReq('POST', { content: VALID_CONTENT });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is missing', async () => {
    const req = await unrestrictedAdminReq('POST', { title: 'Q' });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it(`returns 400 when title exceeds ${FAQ_ITEM_TITLE_MAX_LENGTH} characters`, async () => {
    const req = await unrestrictedAdminReq('POST', {
      title: 'X'.repeat(FAQ_ITEM_TITLE_MAX_LENGTH + 1),
      content: VALID_CONTENT,
    });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is not valid Quill Delta JSON', async () => {
    const req = await unrestrictedAdminReq('POST', {
      title: 'Q',
      content: '<p>plain html is rejected</p>',
    });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is JSON but not a Quill Delta', async () => {
    const req = await unrestrictedAdminReq('POST', {
      title: 'Q',
      content: JSON.stringify({ text: 'hello' }),
    });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it(`returns 400 when plain-text content exceeds ${FAQ_ITEM_CONTENT_MAX_LENGTH} characters`, async () => {
    const req = await unrestrictedAdminReq('POST', {
      title: 'Q',
      content: OVER_LIMIT_CONTENT,
    });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    const res = await postItem(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it('returns 201 with item data on success', async () => {
    const req = await unrestrictedAdminReq('POST', {
      title: 'How to vote?',
      content: VALID_CONTENT,
    });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqItem.findFirst.mockResolvedValueOnce(null);
    prismaMock.faqItem.create.mockResolvedValueOnce({
      id: 'item-1',
      category_id: 'cat-1',
      title: 'How to vote?',
      content: VALID_CONTENT,
      position: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const { status, body } = await parseJson<any>(await postItem(req, catParams('cat-1')));
    expect(status).toBe(201);
    expect(body.title).toBe('How to vote?');
    expect(body.categoryId).toBe('cat-1');
  });

  it('stores Quill Delta content verbatim in the database', async () => {
    const req = await unrestrictedAdminReq('POST', {
      title: 'Q',
      content: VALID_CONTENT,
    });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqItem.findFirst.mockResolvedValueOnce(null);
    prismaMock.faqItem.create.mockResolvedValueOnce({
      id: 'item-1',
      category_id: 'cat-1',
      title: 'Q',
      content: VALID_CONTENT,
      position: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await postItem(req, catParams('cat-1'));

    expect(prismaMock.faqItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: VALID_CONTENT }),
      }),
    );
  });

  it('appends item after the last one in the category', async () => {
    const req = await unrestrictedAdminReq('POST', { title: 'Q', content: VALID_CONTENT });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqItem.findFirst.mockResolvedValueOnce({ position: 2 });
    prismaMock.faqItem.create.mockResolvedValueOnce({
      id: 'item-3',
      category_id: 'cat-1',
      title: 'Q',
      content: VALID_CONTENT,
      position: 3,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await postItem(req, catParams('cat-1'));

    expect(prismaMock.faqItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 3 }),
      }),
    );
  });

  it('invalidates the FAQ cache after creating an item', async () => {
    const req = await unrestrictedAdminReq('POST', { title: 'Q', content: VALID_CONTENT });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqItem.findFirst.mockResolvedValueOnce(null);
    prismaMock.faqItem.create.mockResolvedValueOnce({
      id: 'item-1',
      category_id: 'cat-1',
      title: 'Q',
      content: VALID_CONTENT,
      position: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await postItem(req, catParams('cat-1'));

    expect(cacheMock.invalidateFaq).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// PUT /api/faq/items/[id]
// ===========================================================================

describe('PUT /api/faq/items/[id]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Update FAQ item');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'PUT', body: { title: 'Q', content: VALID_CONTENT } });
    const res = await putItem(req, itemParams('item-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when restricted admin', async () => {
    const req = await restrictedAdminReq('PUT', { title: 'Q', content: VALID_CONTENT });
    const res = await putItem(req, itemParams('item-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when item does not exist', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'Q', content: VALID_CONTENT });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce(null);
    const res = await putItem(req, itemParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when title is missing', async () => {
    const req = await unrestrictedAdminReq('PUT', { content: VALID_CONTENT });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    const res = await putItem(req, itemParams('item-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is missing', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'Q' });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    const res = await putItem(req, itemParams('item-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is not valid Quill Delta JSON', async () => {
    const req = await unrestrictedAdminReq('PUT', {
      title: 'Q',
      content: '<p>html is rejected</p>',
    });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    const res = await putItem(req, itemParams('item-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is JSON but not a Quill Delta', async () => {
    const req = await unrestrictedAdminReq('PUT', {
      title: 'Q',
      content: JSON.stringify({ text: 'hello' }),
    });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    const res = await putItem(req, itemParams('item-1'));
    expect(res.status).toBe(400);
  });

  it(`returns 400 when plain-text content exceeds ${FAQ_ITEM_CONTENT_MAX_LENGTH} characters`, async () => {
    const req = await unrestrictedAdminReq('PUT', {
      title: 'Q',
      content: OVER_LIMIT_CONTENT,
    });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    const res = await putItem(req, itemParams('item-1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 with updated item on success', async () => {
    const updatedContent = makeQuillContent('Updated answer.');
    const req = await unrestrictedAdminReq('PUT', {
      title: 'Updated Q',
      content: updatedContent,
    });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    prismaMock.faqItem.update.mockResolvedValueOnce({
      id: 'item-1',
      category_id: 'cat-1',
      title: 'Updated Q',
      content: updatedContent,
      position: 0,
      updated_at: new Date(),
    });

    const { status, body } = await parseJson<any>(await putItem(req, itemParams('item-1')));
    expect(status).toBe(200);
    expect(body.title).toBe('Updated Q');
    expect(body.categoryId).toBe('cat-1');
    expect(body.updatedAt).toBeDefined();
  });

  it('stores Quill Delta content verbatim in the database', async () => {
    const richContent = makeQuillContent('Bold answer with details.');
    const req = await unrestrictedAdminReq('PUT', { title: 'Q', content: richContent });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    prismaMock.faqItem.update.mockResolvedValueOnce({
      id: 'item-1',
      category_id: 'cat-1',
      title: 'Q',
      content: richContent,
      position: 0,
      updated_at: new Date(),
    });

    await putItem(req, itemParams('item-1'));

    expect(prismaMock.faqItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: richContent }),
      }),
    );
  });

  it('stores updated_by from authenticated user', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'Q', content: VALID_CONTENT });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    prismaMock.faqItem.update.mockResolvedValueOnce({
      id: 'item-1',
      category_id: 'cat-1',
      title: 'Q',
      content: VALID_CONTENT,
      position: 0,
      updated_at: new Date(),
    });

    await putItem(req, itemParams('item-1'));

    expect(prismaMock.faqItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ updated_by: 'superadmin-001' }),
      }),
    );
  });

  it('invalidates the FAQ cache after updating an item', async () => {
    const req = await unrestrictedAdminReq('PUT', { title: 'Q', content: VALID_CONTENT });
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    prismaMock.faqItem.update.mockResolvedValueOnce({
      id: 'item-1',
      category_id: 'cat-1',
      title: 'Q',
      content: VALID_CONTENT,
      position: 0,
      updated_at: new Date(),
    });

    await putItem(req, itemParams('item-1'));

    expect(cacheMock.invalidateFaq).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// DELETE /api/faq/items/[id]
// ===========================================================================

describe('DELETE /api/faq/items/[id]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Delete FAQ item');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await deleteItem(req, itemParams('item-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when restricted admin', async () => {
    const req = await restrictedAdminReq('DELETE');
    const res = await deleteItem(req, itemParams('item-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when item does not exist', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqItem.findUnique.mockResolvedValueOnce(null);
    const res = await deleteItem(req, itemParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with deletedId on success', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    prismaMock.faqItem.delete.mockResolvedValueOnce({ id: 'item-1' });

    const { status, body } = await parseJson<any>(await deleteItem(req, itemParams('item-1')));
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deletedId).toBe('item-1');
  });

  it('calls prisma.faqItem.delete with the correct id', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-99' });
    prismaMock.faqItem.delete.mockResolvedValueOnce({ id: 'item-99' });

    await deleteItem(req, itemParams('item-99'));

    expect(prismaMock.faqItem.delete).toHaveBeenCalledWith({ where: { id: 'item-99' } });
  });

  it('invalidates the FAQ cache after deleting an item', async () => {
    const req = await unrestrictedAdminReq('DELETE');
    prismaMock.faqItem.findUnique.mockResolvedValueOnce({ id: 'item-1' });
    prismaMock.faqItem.delete.mockResolvedValueOnce({ id: 'item-1' });

    await deleteItem(req, itemParams('item-1'));

    expect(cacheMock.invalidateFaq).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// PATCH /api/faq/categories/reorder
// ===========================================================================

describe('PATCH /api/faq/categories/reorder', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Reorder FAQ categories');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'PATCH', body: { order: ['cat-1', 'cat-2'] } });
    const res = await reorderCategories(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when restricted admin', async () => {
    const req = await restrictedAdminReq('PATCH', { order: ['cat-1', 'cat-2'] });
    const res = await reorderCategories(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when order is not an array', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: 'not-an-array' });
    const res = await reorderCategories(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when order contains unknown category IDs', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: ['unknown-cat'] });
    prismaMock.faqCategory.findMany.mockResolvedValueOnce([{ id: 'cat-1' }, { id: 'cat-2' }]);
    const res = await reorderCategories(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 and updates positions via transaction', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: ['cat-2', 'cat-1'] });
    prismaMock.faqCategory.findMany.mockResolvedValueOnce([{ id: 'cat-1' }, { id: 'cat-2' }]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const { status, body } = await parseJson<any>(await reorderCategories(req));
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('invalidates the FAQ cache after reordering categories', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: ['cat-2', 'cat-1'] });
    prismaMock.faqCategory.findMany.mockResolvedValueOnce([{ id: 'cat-1' }, { id: 'cat-2' }]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    await reorderCategories(req);

    expect(cacheMock.invalidateFaq).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// PATCH /api/faq/categories/[id]/items/reorder
// ===========================================================================

describe('PATCH /api/faq/categories/[id]/items/reorder', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('FAQ');
    allure.story('Reorder FAQ items within category');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'PATCH', body: { order: ['item-1', 'item-2'] } });
    const res = await reorderItems(req, catParams('cat-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when restricted admin', async () => {
    const req = await restrictedAdminReq('PATCH', { order: ['item-1'] });
    const res = await reorderItems(req, catParams('cat-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when category does not exist', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: ['item-1'] });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce(null);
    const res = await reorderItems(req, catParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when order contains IDs from another category', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: ['item-foreign'] });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqItem.findMany.mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }]);
    const res = await reorderItems(req, catParams('cat-1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 and reorders items atomically', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: ['item-2', 'item-1'] });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqItem.findMany.mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const { status, body } = await parseJson<any>(await reorderItems(req, catParams('cat-1')));
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('invalidates the FAQ cache after reordering items', async () => {
    const req = await unrestrictedAdminReq('PATCH', { order: ['item-2', 'item-1'] });
    prismaMock.faqCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
    prismaMock.faqItem.findMany.mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }]);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    await reorderItems(req, catParams('cat-1'));

    expect(cacheMock.invalidateFaq).toHaveBeenCalledTimes(1);
  });
});

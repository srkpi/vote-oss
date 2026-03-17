import * as allure from 'allure-js-commons';

import { redisMock, resetRedisMock } from '@/__tests__/helpers/redis-mock';

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------
jest.mock('@/lib/redis', () => ({
  redis: redisMock,
  isRedisReady: jest.fn(() => true),
  safeRedis: async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  },
}));

import { fetchFacultyGroups, fixFacultyName } from '@/lib/campus-api';

// ---------------------------------------------------------------------------
// Helper: stub global fetch
// ---------------------------------------------------------------------------

function mockFetch(data: unknown, status = 200) {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response);
}

const SAMPLE_API_RESPONSE = [
  { id: 1, name: 'KV-91', faculty: 'FICE' },
  { id: 2, name: 'KV-11', faculty: 'FICE' },
  { id: 3, name: 'EL-21', faculty: 'FEL' },
  { id: 4, name: 'ІМ-41мн', faculty: 'ННІМЗ' }, // malformed → НН ІМЗ
  { id: 5, name: 'ФТ-51', faculty: 'НН ФТІ' }, // already correct
];

describe('fixFacultyName', () => {
  beforeEach(() => allure.story('fixFacultyName'));

  it('leaves correctly formatted НН names unchanged', () => {
    expect(fixFacultyName('НН ФТІ')).toBe('НН ФТІ');
    expect(fixFacultyName('НН ІМЗ')).toBe('НН ІМЗ');
  });

  it('inserts a space after НН when missing', () => {
    expect(fixFacultyName('ННІМЗ')).toBe('НН ІМЗ');
    expect(fixFacultyName('ННФТІ')).toBe('НН ФТІ');
  });

  it('leaves plain non-НН faculty names unchanged', () => {
    expect(fixFacultyName('FICE')).toBe('FICE');
    expect(fixFacultyName('ФЕЛ')).toBe('ФЕЛ');
    expect(fixFacultyName('ФІОТ')).toBe('ФІОТ');
  });

  it('leaves "НН" alone (length ≤ 2) without error', () => {
    expect(fixFacultyName('НН')).toBe('НН');
  });

  it('leaves empty string unchanged', () => {
    expect(fixFacultyName('')).toBe('');
  });
});

describe('fetchFacultyGroups', () => {
  beforeEach(() => {
    resetRedisMock();
    allure.feature('Campus API');
    allure.story('fetchFacultyGroups');

    // Always install a jest spy so `expect(global.fetch).not.toHaveBeenCalled()`
    // works even in tests where mockFetch() is never called.
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue([]),
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns cached data on a Redis hit (no upstream fetch)', async () => {
    const cached = { FICE: ['KV-91'], FEL: ['EL-21'] };
    redisMock.get.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await fetchFacultyGroups();

    expect(result).toEqual(cached);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches from campus API on a cache miss', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/group/all'));
    expect(result).toHaveProperty('FICE');
    expect(result).toHaveProperty('FEL');
  });

  it('stores the result in Redis after a cache miss', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    await fetchFacultyGroups();

    expect(redisMock.set).toHaveBeenCalledWith(
      'cache:campus:groups',
      expect.any(String),
      'EX',
      expect.any(Number),
    );
  });

  it('normalises malformed НН faculty names', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();

    // "ННІМЗ" should be normalised to "НН ІМЗ"
    expect(result['НН ІМЗ']).toContain('ІМ-41мн');
    expect(result['ННІМЗ']).toBeUndefined();
  });

  it('preserves already-correct НН names', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();

    expect(result['НН ФТІ']).toContain('ФТ-51');
  });

  it('sorts groups alphabetically within each faculty', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();
    const ficeGroups = result['FICE'];

    expect(ficeGroups).toEqual([...ficeGroups].sort((a, b) => a.localeCompare(b, 'uk')));
  });

  it('throws when the campus API returns a non-OK status', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(null, 503);

    await expect(fetchFacultyGroups()).rejects.toThrow('503');
  });

  it('falls through to upstream fetch when cached JSON is malformed', async () => {
    redisMock.get.mockResolvedValueOnce('not valid json {{');
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();
    expect(result).toHaveProperty('FICE');
  });
});

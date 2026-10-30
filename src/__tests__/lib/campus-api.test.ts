import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { redisMock, resetRedisMock } from '@/__tests__/helpers/redis-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------
vi.mock('@/lib/redis', async () => {
  const { redisMock } = await import('@/__tests__/helpers/redis-mock');
  return {
    redis: redisMock,
    isRedisReady: vi.fn(() => true),
    safeRedis: async <T>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch {
        return null;
      }
    },
  };
});

import { fetchFacultyGroups, fixFacultyName } from '@/lib/campus-api';

// ---------------------------------------------------------------------------
// Helper: stub global fetch
// ---------------------------------------------------------------------------

function mockFetch(data: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValue(Response.json(data, { status }));
}

const SAMPLE_API_RESPONSE = [
  { id: 1, name: 'KV-91', faculty: 'FICE' },
  { id: 2, name: 'KV-11', faculty: 'FICE' },
  { id: 3, name: 'EL-21', faculty: 'FEL' },
  { id: 4, name: 'ІМ-41мн', faculty: 'ННІМЗ' }, // malformed → НН ІМЗ
  { id: 5, name: 'ФТ-51', faculty: 'НН ФТІ' }, // already correct
];

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetRedisMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Normalizing a faculty name', () => {
  beforeEach(() => allure.story('fixFacultyName'));

  it('should leave correctly formatted НН names unchanged when normalizing a faculty name', () => {
    expect(fixFacultyName('НН ФТІ')).toBe('НН ФТІ');
    expect(fixFacultyName('НН ІМЗ')).toBe('НН ІМЗ');
  });

  it('should insert a space after НН when missing', () => {
    expect(fixFacultyName('ННІМЗ')).toBe('НН ІМЗ');
    expect(fixFacultyName('ННФТІ')).toBe('НН ФТІ');
  });

  it('should leave plain non-НН faculty names unchanged when normalizing a faculty name', () => {
    expect(fixFacultyName('FICE')).toBe('FICE');
    expect(fixFacultyName('ФЕЛ')).toBe('ФЕЛ');
    expect(fixFacultyName('ФІОТ')).toBe('ФІОТ');
  });

  it('should leave "НН" alone (length ≤ 2) without error when normalizing a faculty name', () => {
    expect(fixFacultyName('НН')).toBe('НН');
  });

  it('should leave empty string unchanged when normalizing a faculty name', () => {
    expect(fixFacultyName('')).toBe('');
  });
});

describe('Loading faculty groups', () => {
  beforeEach(() => {
    allure.feature('Campus API');
    allure.story('fetchFacultyGroups');

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(Response.json([])));
  });

  it('should return cached data on a Redis hit (no upstream fetch) when loading faculty groups', async () => {
    const cached = { FICE: ['KV-91'], FEL: ['EL-21'] };
    redisMock.get.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await fetchFacultyGroups();

    expect(result).toEqual(cached);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch from campus API when the cache is empty', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/group/all'));
    expect(result).toHaveProperty('FICE');
    expect(result).toHaveProperty('FEL');
  });

  it('should store the result in Redis after a cache miss', async () => {
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

  it('should normalize malformed НН faculty names when loading faculty groups', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();

    // "ННІМЗ" should be normalised to "НН ІМЗ"
    expect(result['НН ІМЗ']).toContain('ІМ-41мн');
    expect(result['ННІМЗ']).toBeUndefined();
  });

  it('should preserve already-correct НН names when loading faculty groups', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();

    expect(result['НН ФТІ']).toContain('ФТ-51');
  });

  it('should sort groups alphabetically within each faculty when loading faculty groups', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();
    const ficeGroups = result['FICE'];

    expect(ficeGroups).toEqual([...ficeGroups].sort((a, b) => a.localeCompare(b, 'uk')));
  });

  it('should throw when the campus API returns a non-OK status', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    mockFetch(null, 503);

    await expect(fetchFacultyGroups()).rejects.toThrow('503');
  });

  it('should fall through to upstream fetch when cached JSON is malformed', async () => {
    redisMock.get.mockResolvedValueOnce('not valid json {{');
    mockFetch(SAMPLE_API_RESPONSE);

    const result = await fetchFacultyGroups();
    expect(result).toHaveProperty('FICE');
  });

  it('should refetch when cached JSON has an invalid shape', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ FICE: 123 }));
    mockFetch(SAMPLE_API_RESPONSE);
    expect(await fetchFacultyGroups()).toHaveProperty('FICE', ['KV-11', 'KV-91']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, [null], [{ name: 'Group', faculty: 123 }]])(
    'should reject invalid upstream data without caching it: %j when loading faculty groups',
    async (input) => {
      redisMock.get.mockResolvedValueOnce(null);
      mockFetch(input);
      await expect(fetchFacultyGroups()).rejects.toThrow('invalid group data');
      expect(redisMock.set).not.toHaveBeenCalled();
    },
  );
});

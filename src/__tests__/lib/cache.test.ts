import * as allure from 'allure-js-commons';

import type { CachedElection } from '@/lib/cache';

import { redisMock, resetRedisMock } from '../helpers/redis-mock';

// ---------------------------------------------------------------------------
// Module mock
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

import {
  getCachedAdmins,
  getCachedElections,
  invalidateAdmins,
  invalidateElections,
  setCachedAdmins,
  setCachedElections,
} from '@/lib/cache';

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------

const SAMPLE_CACHED_ELECTION: CachedElection = {
  id: 'sample-uuid',
  title: 'Test Election',
  createdAt: '2024-01-01T00:00:00.000Z',
  opensAt: new Date(Date.now() - 60_000).toISOString(),
  closesAt: new Date(Date.now() + 3_600_000).toISOString(),
  restrictedToFaculty: null,
  restrictedToGroup: null,
  publicKey: '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----',
  privateKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
  creator: { full_name: 'Admin', faculty: 'FICE' },
  choices: [],
  ballotCount: 0,
};

const SAMPLE_ADMIN = {
  user_id: 'admin-001',
  full_name: 'Admin',
  group: 'KV-11',
  faculty: 'FICE',
  promoted_by: null,
  promoted_at: new Date('2024-01-01'),
  manage_admins: true,
  restricted_to_faculty: false,
};

describe('cache', () => {
  beforeEach(() => {
    resetRedisMock();
    allure.feature('Redis Cache');
  });

  describe('getCachedElections', () => {
    beforeEach(() => allure.story('getCachedElections'));

    it('returns null on a cache miss', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      expect(await getCachedElections()).toBeNull();
    });

    it('parses and returns the cached array on a cache hit', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify([SAMPLE_CACHED_ELECTION]));
      const result = await getCachedElections();
      expect(result).toHaveLength(1);
      expect(result![0].title).toBe('Test Election');
    });

    it('uses the key cache:elections', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      await getCachedElections();
      expect(redisMock.get).toHaveBeenCalledWith('cache:elections');
    });

    it('returns null when Redis is unavailable (safeRedis catches error)', async () => {
      redisMock.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await getCachedElections()).toBeNull();
    });

    it('returns null when cached value is malformed JSON', async () => {
      redisMock.get.mockResolvedValueOnce('not valid json {{');
      expect(await getCachedElections()).toBeNull();
    });

    it('cached entries do not contain a status field', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify([SAMPLE_CACHED_ELECTION]));
      const result = await getCachedElections();
      expect(result![0]).not.toHaveProperty('status');
    });
  });

  describe('setCachedElections', () => {
    beforeEach(() => allure.story('setCachedElections'));

    it('serialises the array and stores it under cache:elections with a 60-second TTL', async () => {
      const data = [SAMPLE_CACHED_ELECTION];
      await setCachedElections(data);
      expect(redisMock.set).toHaveBeenCalledWith('cache:elections', JSON.stringify(data), 'EX', 60);
    });

    it('does not throw when Redis is unavailable', async () => {
      redisMock.set.mockRejectedValueOnce(new Error('timeout'));
      await expect(setCachedElections([])).resolves.toBeUndefined();
    });
  });

  describe('invalidateElections', () => {
    beforeEach(() => allure.story('invalidateElections'));

    it('deletes the cache:elections key', async () => {
      await invalidateElections();
      expect(redisMock.del).toHaveBeenCalledWith('cache:elections');
    });

    it('does not throw when Redis is unavailable', async () => {
      redisMock.del.mockRejectedValueOnce(new Error('down'));
      await expect(invalidateElections()).resolves.toBeUndefined();
    });
  });

  // ── Admins cache ──────────────────────────────────────────────────────────

  describe('getCachedAdmins', () => {
    beforeEach(() => allure.story('getCachedAdmins'));

    it('returns null on a cache miss', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      expect(await getCachedAdmins()).toBeNull();
    });

    it('parses and returns the cached admin array', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify([SAMPLE_ADMIN]));
      const result = await getCachedAdmins();
      expect(result).toHaveLength(1);
      expect(result![0].user_id).toBe('admin-001');
    });

    it('uses the key cache:admins', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      await getCachedAdmins();
      expect(redisMock.get).toHaveBeenCalledWith('cache:admins');
    });

    it('returns null on malformed JSON', async () => {
      redisMock.get.mockResolvedValueOnce('{invalid');
      expect(await getCachedAdmins()).toBeNull();
    });
  });

  describe('setCachedAdmins', () => {
    beforeEach(() => allure.story('setCachedAdmins'));

    it('stores the admin array with a 30-second TTL', async () => {
      await setCachedAdmins([SAMPLE_ADMIN] as Parameters<typeof setCachedAdmins>[0]);
      expect(redisMock.set).toHaveBeenCalledWith(
        'cache:admins',
        JSON.stringify([SAMPLE_ADMIN]),
        'EX',
        30,
      );
    });
  });

  describe('invalidateAdmins', () => {
    beforeEach(() => allure.story('invalidateAdmins'));

    it('deletes the cache:admins key', async () => {
      await invalidateAdmins();
      expect(redisMock.del).toHaveBeenCalledWith('cache:admins');
    });

    it('does not throw when Redis is unavailable', async () => {
      redisMock.del.mockRejectedValueOnce(new Error('down'));
      await expect(invalidateAdmins()).resolves.toBeUndefined();
    });
  });
});

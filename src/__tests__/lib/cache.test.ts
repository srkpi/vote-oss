import * as allure from 'allure-js-commons';

import type { Election } from '@/types/election';

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

const SAMPLE_ELECTION: Partial<Election> = {
  id: 1,
  title: 'Test Election',
  status: 'open',
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

  // ── Elections cache ───────────────────────────────────────────────────────

  describe('getCachedElections', () => {
    beforeEach(() => allure.story('getCachedElections'));

    it('returns null on a cache miss', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      expect(await getCachedElections('FICE', 'KV-11')).toBeNull();
    });

    it('parses and returns the cached array on a cache hit', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify([SAMPLE_ELECTION]));
      const result = await getCachedElections('FICE', 'KV-11');
      expect(result).toHaveLength(1);
      expect(result![0].id).toBe(1);
    });

    it('uses the key cache:elections:{faculty}:{group}', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      await getCachedElections('FEL', 'EL-21');
      expect(redisMock.get).toHaveBeenCalledWith('cache:elections:FEL:EL-21');
    });

    it('returns null when Redis is unavailable (safeRedis catches error)', async () => {
      redisMock.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await getCachedElections('FICE', 'KV-11')).toBeNull();
    });

    it('returns null when cached value is malformed JSON', async () => {
      redisMock.get.mockResolvedValueOnce('not valid json {{');
      expect(await getCachedElections('FICE', 'KV-11')).toBeNull();
    });
  });

  describe('setCachedElections', () => {
    beforeEach(() => allure.story('setCachedElections'));

    it('serialises the array and stores it with a 60-second TTL', async () => {
      const data = [SAMPLE_ELECTION] as Election[];
      await setCachedElections('FICE', 'KV-11', data);
      expect(redisMock.set).toHaveBeenCalledWith(
        'cache:elections:FICE:KV-11',
        JSON.stringify(data),
        'EX',
        60,
      );
    });

    it('does not throw when Redis is unavailable', async () => {
      redisMock.set.mockRejectedValueOnce(new Error('timeout'));
      await expect(setCachedElections('FICE', 'KV-11', [])).resolves.toBeUndefined();
    });
  });

  describe('invalidateElections', () => {
    beforeEach(() => allure.story('invalidateElections'));

    it('calls del with matching keys returned by SCAN', async () => {
      redisMock.scan.mockResolvedValueOnce([
        '0',
        ['cache:elections:FICE:KV-11', 'cache:elections:FEL:EL-21'],
      ]);
      await invalidateElections();
      expect(redisMock.del).toHaveBeenCalledWith(
        'cache:elections:FICE:KV-11',
        'cache:elections:FEL:EL-21',
      );
    });

    it('does not call del when no keys match', async () => {
      redisMock.scan.mockResolvedValueOnce(['0', []]);
      await invalidateElections();
      expect(redisMock.del).not.toHaveBeenCalled();
    });

    it('paginates SCAN until cursor is "0"', async () => {
      redisMock.scan.mockResolvedValueOnce(['42', ['key1']]).mockResolvedValueOnce(['0', ['key2']]);
      await invalidateElections();
      expect(redisMock.scan).toHaveBeenCalledTimes(2);
      expect(redisMock.del).toHaveBeenCalledWith('key1', 'key2');
    });

    it('does not throw when Redis is unavailable', async () => {
      redisMock.scan.mockRejectedValueOnce(new Error('down'));
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

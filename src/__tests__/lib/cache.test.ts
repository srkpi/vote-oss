import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { redisMock, resetRedisMock } from '@/__tests__/helpers/redis-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';
import type { CachedElection } from '@/types/election';

// ---------------------------------------------------------------------------
// Module mock
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

import {
  getCachedAdmins,
  getCachedElections,
  invalidateAdmins,
  invalidateElections,
  setCachedAdmins,
  setCachedElections,
} from '@/lib/cache';
import {
  CACHE_KEY_ADMINS,
  CACHE_KEY_ELECTIONS,
  CACHE_TTL_ADMINS_SECS,
  CACHE_TTL_ELECTIONS_SECS,
} from '@/lib/constants';
import type { Admin } from '@/types/admin';

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------

const SAMPLE_CACHED_ELECTION: CachedElection = {
  id: 'sample-uuid',
  type: 'ELECTION',
  title: 'Test Election',
  description: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  opensAt: new Date(TEST_NOW - 60_000).toISOString(),
  closesAt: new Date(TEST_NOW + 3_600_000).toISOString(),
  minChoices: 1,
  maxChoices: 1,
  shuffleChoices: false,
  restrictions: [],
  publicKey: '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----',
  privateKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
  createdByFullName: 'Admin',
  choices: [],
  ballotCount: 0,
  createdBy: 'admin-001',
  approved: true,
  approvedById: 'admin-001',
  approvedByFullName: 'Admin',
  approvedAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
  deletedByUserId: null,
  deletedByName: null,
  editedAt: null,
  editedByName: null,
  editedByUserId: null,
  winningConditions: {
    hasMostVotes: true,
    reachesPercentage: null,
    reachesVotes: null,
    quorum: null,
  },
  publicViewing: false,
  anonymous: true,
};

const SAMPLE_ADMIN: Admin = {
  userId: 'admin-001',
  fullName: 'Admin',
  group: 'KV-11',
  faculty: 'FICE',
  promoter: null,
  promotedAt: new Date('2024-01-01').toISOString(),
  avatarUrl: null,
  manageAdmins: true,
  restrictedToFaculty: false,
  manageGroups: false,
  managePetitions: false,
  manageFaq: false,
};

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetRedisMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Cached election and admin data', () => {
  beforeEach(() => {
    allure.feature('Redis Cache');
  });

  describe('Reading cached elections', () => {
    beforeEach(() => allure.story('getCachedElections'));

    it('should return null when the cache is empty', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      expect(await getCachedElections()).toBeNull();
    });

    it('should return the saved elections when cached data is available', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify([SAMPLE_CACHED_ELECTION]));
      const result = await getCachedElections();
      expect(result).toHaveLength(1);
      expect(result![0].title).toBe('Test Election');
    });

    it('should read from the election cache key when loading cached elections', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      await getCachedElections();
      expect(redisMock.get).toHaveBeenCalledWith(CACHE_KEY_ELECTIONS);
    });

    it('should return null when Redis is unavailable (safeRedis catches error)', async () => {
      redisMock.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await getCachedElections()).toBeNull();
    });

    it('should return null when cached value is malformed JSON', async () => {
      redisMock.get.mockResolvedValueOnce('not valid json {{');
      expect(await getCachedElections()).toBeNull();
    });

    it('should omit election status when caching election records', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify([SAMPLE_CACHED_ELECTION]));
      const result = await getCachedElections();
      expect(result![0]).not.toHaveProperty('status');
    });
  });

  describe('Caching elections', () => {
    beforeEach(() => allure.story('setCachedElections'));

    it('should serialize the array and stores it under with TTL when caching elections', async () => {
      const data = [SAMPLE_CACHED_ELECTION];
      await setCachedElections(data);
      expect(redisMock.set).toHaveBeenCalledWith(
        CACHE_KEY_ELECTIONS,
        JSON.stringify(data),
        'EX',
        CACHE_TTL_ELECTIONS_SECS,
      );
    });

    it('should not throw when Redis is unavailable', async () => {
      redisMock.set.mockRejectedValueOnce(new Error('timeout'));
      await expect(setCachedElections([])).resolves.toBeUndefined();
    });
  });

  describe('Invalidating cached elections', () => {
    beforeEach(() => allure.story('invalidateElections'));

    it('should delete the cache key when invalidating cached elections', async () => {
      await invalidateElections();
      expect(redisMock.del).toHaveBeenCalledWith(CACHE_KEY_ELECTIONS);
    });

    it('should not throw when Redis is unavailable', async () => {
      redisMock.del.mockRejectedValueOnce(new Error('down'));
      await expect(invalidateElections()).resolves.toBeUndefined();
    });
  });

  // ── Admins cache ──────────────────────────────────────────────────────────

  describe('Reading cached admins', () => {
    beforeEach(() => allure.story('getCachedAdmins'));

    it('should return null when the cache is empty', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      expect(await getCachedAdmins()).toBeNull();
    });

    it('should return the saved admins when cached data is available', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify([SAMPLE_ADMIN]));
      const result = await getCachedAdmins();
      expect(result).toHaveLength(1);
      expect(result![0].userId).toBe('admin-001');
    });

    it('should read from the admin cache key when loading cached admins', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      await getCachedAdmins();
      expect(redisMock.get).toHaveBeenCalledWith(CACHE_KEY_ADMINS);
    });

    it('should return null on malformed JSON when reading cached admins', async () => {
      redisMock.get.mockResolvedValueOnce('{invalid');
      expect(await getCachedAdmins()).toBeNull();
    });
  });

  describe('Caching admins', () => {
    beforeEach(() => allure.story('setCachedAdmins'));

    it('should store the admin array with TTL when caching admins', async () => {
      await setCachedAdmins([SAMPLE_ADMIN] as unknown as Parameters<typeof setCachedAdmins>[0]);
      expect(redisMock.set).toHaveBeenCalledWith(
        CACHE_KEY_ADMINS,
        JSON.stringify([SAMPLE_ADMIN]),
        'EX',
        CACHE_TTL_ADMINS_SECS,
      );
    });
  });

  describe('Invalidating cached admins', () => {
    beforeEach(() => allure.story('invalidateAdmins'));

    it('should delete the cache key when invalidating cached admins', async () => {
      await invalidateAdmins();
      expect(redisMock.del).toHaveBeenCalledWith(CACHE_KEY_ADMINS);
    });

    it('should not throw when Redis is unavailable', async () => {
      redisMock.del.mockRejectedValueOnce(new Error('down'));
      await expect(invalidateAdmins()).resolves.toBeUndefined();
    });
  });
});

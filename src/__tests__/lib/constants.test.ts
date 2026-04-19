/**
 * Smoke-test the constants module.
 *
 * These tests are intentionally trivial: they exist to catch accidental
 * typos or sign-inversions that would silently break limits across the app.
 */

import {
  ACCESS_TOKEN_TTL_SECS,
  CACHE_KEY_ADMINS,
  CACHE_KEY_ELECTIONS,
  CACHE_TTL_ADMINS_SECS,
  CACHE_TTL_ELECTIONS_SECS,
  CHAR_COUNTER_THRESHOLD,
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_MAX_CHOICES_MAX,
  ELECTION_MAX_CLOSES_AT_DAYS,
  ELECTION_MIN_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
  INVITE_TOKEN_MAX_USAGE_MAX,
  INVITE_TOKEN_MAX_USAGE_MIN,
  REFRESH_TOKEN_TTL_SECS,
} from '@/lib/constants';

describe('constants', () => {
  describe('election limits', () => {
    it('ELECTION_TITLE_MAX_LENGTH is a positive integer', () => {
      expect(Number.isInteger(ELECTION_TITLE_MAX_LENGTH)).toBe(true);
      expect(ELECTION_TITLE_MAX_LENGTH).toBeGreaterThan(0);
    });

    it('ELECTION_CHOICES_MIN < ELECTION_CHOICES_MAX', () => {
      expect(ELECTION_CHOICES_MIN).toBeLessThan(ELECTION_CHOICES_MAX);
    });

    it('ELECTION_CHOICES_MIN is at least 1', () => {
      expect(ELECTION_CHOICES_MIN).toBeGreaterThanOrEqual(1);
    });

    it('ELECTION_MIN_CHOICES_MIN <= ELECTION_MAX_CHOICES_MAX', () => {
      expect(ELECTION_MIN_CHOICES_MIN).toBeLessThanOrEqual(ELECTION_MAX_CHOICES_MAX);
    });

    it('ELECTION_MIN_CHOICES_MIN is at least 1', () => {
      expect(ELECTION_MIN_CHOICES_MIN).toBeGreaterThanOrEqual(1);
    });

    it('ELECTION_MAX_CHOICES_MAX <= ELECTION_CHOICES_MAX', () => {
      expect(ELECTION_MAX_CHOICES_MAX).toBeLessThanOrEqual(ELECTION_CHOICES_MAX);
    });

    it('ELECTION_CHOICE_MAX_LENGTH is a positive integer', () => {
      expect(Number.isInteger(ELECTION_CHOICE_MAX_LENGTH)).toBe(true);
      expect(ELECTION_CHOICE_MAX_LENGTH).toBeGreaterThan(0);
    });

    it('ELECTION_MAX_CLOSES_AT_DAYS is a positive integer', () => {
      expect(Number.isInteger(ELECTION_MAX_CLOSES_AT_DAYS)).toBe(true);
      expect(ELECTION_MAX_CLOSES_AT_DAYS).toBeGreaterThan(0);
    });
  });

  describe('invite token limits', () => {
    it('INVITE_TOKEN_MAX_USAGE_MIN is at least 1', () => {
      expect(INVITE_TOKEN_MAX_USAGE_MIN).toBeGreaterThanOrEqual(1);
    });

    it('INVITE_TOKEN_MAX_USAGE_MIN < INVITE_TOKEN_MAX_USAGE_MAX', () => {
      expect(INVITE_TOKEN_MAX_USAGE_MIN).toBeLessThan(INVITE_TOKEN_MAX_USAGE_MAX);
    });
  });

  describe('cache constants', () => {
    it('cache TTLs are positive numbers', () => {
      expect(CACHE_TTL_ELECTIONS_SECS).toBeGreaterThan(0);
      expect(CACHE_TTL_ADMINS_SECS).toBeGreaterThan(0);
    });

    it('cache keys are non-empty strings', () => {
      expect(typeof CACHE_KEY_ELECTIONS).toBe('string');
      expect(CACHE_KEY_ELECTIONS.length).toBeGreaterThan(0);
      expect(typeof CACHE_KEY_ADMINS).toBe('string');
      expect(CACHE_KEY_ADMINS.length).toBeGreaterThan(0);
    });

    it('elections and admins cache keys are distinct', () => {
      expect(CACHE_KEY_ELECTIONS).not.toBe(CACHE_KEY_ADMINS);
    });
  });

  describe('JWT TTLs', () => {
    it('access token TTL is shorter than refresh token TTL', () => {
      expect(ACCESS_TOKEN_TTL_SECS).toBeLessThan(REFRESH_TOKEN_TTL_SECS);
    });

    it('access token TTL is 15 minutes', () => {
      expect(ACCESS_TOKEN_TTL_SECS).toBe(900);
    });

    it('refresh token TTL is 7 days', () => {
      expect(REFRESH_TOKEN_TTL_SECS).toBe(60 * 60 * 24 * 7);
    });
  });

  describe('CHAR_COUNTER_THRESHOLD', () => {
    it('is between 0 and 1 exclusive', () => {
      expect(CHAR_COUNTER_THRESHOLD).toBeGreaterThan(0);
      expect(CHAR_COUNTER_THRESHOLD).toBeLessThan(1);
    });
  });
});

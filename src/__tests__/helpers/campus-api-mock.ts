import { vi } from 'vitest';

/**
 * Mock for @/lib/campus-api's fetchFacultyGroups.
 *
 * Usage:
 *   import { fetchFacultyGroupsMock } from '@/__tests__/helpers/campus-api-mock';
 *   vi.mock('@/lib/campus-api', async () => {
 *     const { fetchFacultyGroupsMock } = await import('@/__tests__/helpers/campus-api-mock');
 *     return { fetchFacultyGroups: fetchFacultyGroupsMock };
 *   });
 */

export const fetchFacultyGroupsMock = vi.fn<(...args: []) => Promise<Record<string, string[]>>>();

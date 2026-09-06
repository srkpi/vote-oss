/**
 * Mock for @/lib/campus-api's fetchFacultyGroups.
 *
 * Usage:
 *   import { fetchFacultyGroupsMock } from '@/__tests__/helpers/campus-api-mock';
 *   jest.mock('@/lib/campus-api', () => ({ fetchFacultyGroups: fetchFacultyGroupsMock }));
 */

export const fetchFacultyGroupsMock = jest.fn<Promise<Record<string, string[]>>, []>();

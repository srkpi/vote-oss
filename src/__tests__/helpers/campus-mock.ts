/**
 * Mock for @/lib/campus-api.
 *
 * Usage:
 *   import { campusMock, resetCampusMock } from '../../helpers/campus-mock';
 *   jest.mock('@/lib/campus-api', () => campusMock);
 *   beforeEach(() => resetCampusMock());
 *
 * Default: `fetchFacultyGroups` resolves with a small representative map that
 * contains the faculties and groups referenced by fixture data (FICE, FEL …).
 */

export const MOCK_FACULTY_GROUPS: Record<string, string[]> = {
  FICE: ['KV-11', 'KV-12', 'KV-91', 'KV-92'],
  FEL: ['EL-11', 'EL-21', 'EL-31'],
  FMF: ['MT-11', 'MT-31'],
  'НН ФТІ': ['ФТ-51', 'ФТ-61'],
  'НН ІМЗ': ['ІМ-41мн'],
};

export const campusMock = {
  fetchFacultyGroups: jest.fn<Promise<Record<string, string[]>>, []>(),
  fixFacultyName: jest.fn((faculty: string) => faculty),
  invalidateCampusGroupsCache: jest.fn<Promise<void>, []>(),
};

export function resetCampusMock(): void {
  campusMock.fetchFacultyGroups.mockReset().mockResolvedValue({ ...MOCK_FACULTY_GROUPS });
  campusMock.fixFacultyName.mockReset().mockImplementation((faculty: string) => faculty);
  campusMock.invalidateCampusGroupsCache.mockReset().mockResolvedValue(undefined);
}

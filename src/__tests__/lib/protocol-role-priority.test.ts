import { describe, it, expect } from 'vitest';

import {
  compareByRoleImportance,
  getRolePriority,
  ROLE_PRIORITY_OTHER,
} from '@/lib/utils/protocol-role-priority';

// ── getRolePriority ───────────────────────────────────────────────────────

describe('Ranking protocol roles', () => {
  it('should rank the exact hierarchy from most to least important when ranking protocol roles', () => {
    expect(getRolePriority('Президент')).toBe(0);
    expect(getRolePriority('Заступник президента')).toBe(1);
    expect(getRolePriority("Виконуючий обов'язки президента")).toBe(2);
    expect(getRolePriority('в.о. президента')).toBe(2);
    expect(getRolePriority('Голова')).toBe(3);
    expect(getRolePriority("Виконуючий обов'язки голови")).toBe(4);
    expect(getRolePriority('в. о. голови')).toBe(4);
    expect(getRolePriority('Секретар')).toBe(5);
    expect(getRolePriority('Заступник голови')).toBe(6);
    expect(getRolePriority('Член')).toBe(7);
  });

  it('should keep each role below the preceding role when ranking roles by importance', () => {
    const ranks = [
      getRolePriority('Президент'),
      getRolePriority('Заступник президента'),
      getRolePriority('в.о. президента'),
      getRolePriority('Голова'),
      getRolePriority('в.о. голови'),
      getRolePriority('Секретар'),
      getRolePriority('Заступник голови'),
      getRolePriority('Член'),
    ];
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThan(ranks[i - 1]!);
    }
  });

  it('should return ROLE_PRIORITY_OTHER for unrecognised or empty roles when ranking protocol roles', () => {
    expect(getRolePriority('Бухгалтер')).toBe(ROLE_PRIORITY_OTHER);
    expect(getRolePriority('')).toBe(ROLE_PRIORITY_OTHER);
    expect(getRolePriority('   ')).toBe(ROLE_PRIORITY_OTHER);
  });

  it('should assign the same role priority when letter casing changes', () => {
    expect(getRolePriority('ГОЛОВА')).toBe(3);
    expect(getRolePriority('президент')).toBe(0);
    expect(getRolePriority('сЕкРеТаР')).toBe(5);
  });

  it('should allow partial matches within a longer posada when ranking protocol roles', () => {
    expect(getRolePriority('Голова Студради')).toBe(3);
    expect(getRolePriority('Член комісії')).toBe(7);
    expect(getRolePriority('Голова наглядової ради')).toBe(3);
  });

  it('should recognize "в.о." in any punctuation/spacing variant when ranking protocol roles', () => {
    expect(getRolePriority('в.о. голови')).toBe(4);
    expect(getRolePriority('в. о. голови')).toBe(4);
    expect(getRolePriority('во голови')).toBe(4);
    expect(getRolePriority('В.О. Голови')).toBe(4);
    expect(getRolePriority('в.о.президента')).toBe(2);
    expect(getRolePriority('во президента')).toBe(2);
  });

  it('should not confuse "Заступник голови" (genitive) with bare "Голова" when ranking protocol roles', () => {
    expect(getRolePriority('Заступник голови')).toBe(6);
    expect(getRolePriority('Заступниця голови')).toBe(6);
  });

  it('should not confuse "Заступник президента" (genitive) with bare "Президент" when ranking protocol roles', () => {
    expect(getRolePriority('Заступник президента')).toBe(1);
  });

  it('should not match unrelated titles that merely share a stem when ranking protocol roles', () => {
    // "Головний" (chief/main) shares the "голов" stem with "Голова" but is a
    // different word (nominative "голова" ends in "а", not "н").
    expect(getRolePriority('Головний бухгалтер')).toBe(ROLE_PRIORITY_OTHER);
    expect(getRolePriority('Головний спеціаліст')).toBe(ROLE_PRIORITY_OTHER);
  });

  it('should recognize acting roles when their apostrophe is straight, curly, or omitted', () => {
    expect(getRolePriority("Виконуючий обов'язки голови")).toBe(4);
    expect(getRolePriority('Виконуючий обов’язки голови')).toBe(4);
    expect(getRolePriority('Виконуючий обовязки голови')).toBe(4);
  });
});

// ── compareByRoleImportance ──────────────────────────────────────────────

describe('Sorting protocol attendees', () => {
  it('should sort a mixed list into the expected importance order when sorting protocol attendees', () => {
    const people = [
      { posada: 'Член', fullname: 'Іванов Іван' },
      { posada: 'Секретар', fullname: 'Петренко Петро' },
      { posada: 'Голова', fullname: 'Сидоренко Сидір' },
      { posada: 'Заступник президента', fullname: 'Коваль Ольга' },
      { posada: 'Президент', fullname: 'Гнатюк Гнат' },
      { posada: 'Бухгалтер', fullname: 'Ковтун Ковтун' },
      { posada: 'в.о. голови', fullname: 'Марченко Марк' },
      { posada: 'Заступник голови', fullname: 'Литвин Лілія' },
    ];

    const sorted = [...people].sort(compareByRoleImportance);

    expect(sorted.map((p) => p.posada)).toEqual([
      'Президент',
      'Заступник президента',
      'Голова',
      'в.о. голови',
      'Секретар',
      'Заступник голови',
      'Член',
      'Бухгалтер',
    ]);
  });

  it('should sort alphabetically by fullname (uk locale) within the same role when sorting protocol attendees', () => {
    const people = [
      { posada: 'Член', fullname: 'Яценко Ярослав' },
      { posada: 'Член', fullname: 'Андрієнко Анна' },
      { posada: 'Член', fullname: 'Іваненко Ігор' },
    ];

    const sorted = [...people].sort(compareByRoleImportance);

    expect(sorted.map((p) => p.fullname)).toEqual([
      'Андрієнко Анна',
      'Іваненко Ігор',
      'Яценко Ярослав',
    ]);
  });

  it('should preserve attendee order when their names and role priorities are equal', () => {
    const a = { posada: 'Член', fullname: 'Однакове Ім’я' };
    const b = { posada: 'Член комісії', fullname: 'Однакове Ім’я' };
    expect(compareByRoleImportance(a, b)).toBe(0);
  });
});

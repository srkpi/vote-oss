import {
  compareByRoleImportance,
  getRolePriority,
  ROLE_PRIORITY_OTHER,
} from '@/lib/utils/protocol-role-priority';

// ── getRolePriority ───────────────────────────────────────────────────────

describe('getRolePriority', () => {
  it('ranks the exact hierarchy from most to least important', () => {
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

  it('is strictly ordered most → least important', () => {
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

  it('returns ROLE_PRIORITY_OTHER for unrecognised or empty roles', () => {
    expect(getRolePriority('Бухгалтер')).toBe(ROLE_PRIORITY_OTHER);
    expect(getRolePriority('')).toBe(ROLE_PRIORITY_OTHER);
    expect(getRolePriority('   ')).toBe(ROLE_PRIORITY_OTHER);
  });

  it('is case-insensitive', () => {
    expect(getRolePriority('ГОЛОВА')).toBe(3);
    expect(getRolePriority('президент')).toBe(0);
    expect(getRolePriority('сЕкРеТаР')).toBe(5);
  });

  it('allows partial matches within a longer posada', () => {
    expect(getRolePriority('Голова Студради')).toBe(3);
    expect(getRolePriority('Член комісії')).toBe(7);
    expect(getRolePriority('Голова наглядової ради')).toBe(3);
  });

  it('recognises "в.о." in any punctuation/spacing variant', () => {
    expect(getRolePriority('в.о. голови')).toBe(4);
    expect(getRolePriority('в. о. голови')).toBe(4);
    expect(getRolePriority('во голови')).toBe(4);
    expect(getRolePriority('В.О. Голови')).toBe(4);
    expect(getRolePriority('в.о.президента')).toBe(2);
    expect(getRolePriority('во президента')).toBe(2);
  });

  it('does not confuse "Заступник голови" (genitive) with bare "Голова"', () => {
    expect(getRolePriority('Заступник голови')).toBe(6);
    expect(getRolePriority('Заступниця голови')).toBe(6);
  });

  it('does not confuse "Заступник президента" (genitive) with bare "Президент"', () => {
    expect(getRolePriority('Заступник президента')).toBe(1);
  });

  it('does not match unrelated titles that merely share a stem', () => {
    // "Головний" (chief/main) shares the "голов" stem with "Голова" but is a
    // different word (nominative "голова" ends in "а", not "н").
    expect(getRolePriority('Головний бухгалтер')).toBe(ROLE_PRIORITY_OTHER);
    expect(getRolePriority('Головний спеціаліст')).toBe(ROLE_PRIORITY_OTHER);
  });

  it('handles the apostrophe in "обов\'язки" with straight, curly, or missing apostrophe', () => {
    expect(getRolePriority("Виконуючий обов'язки голови")).toBe(4);
    expect(getRolePriority('Виконуючий обов’язки голови')).toBe(4);
    expect(getRolePriority('Виконуючий обовязки голови')).toBe(4);
  });
});

// ── compareByRoleImportance ──────────────────────────────────────────────

describe('compareByRoleImportance', () => {
  it('sorts a mixed list into the expected importance order', () => {
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

  it('sorts alphabetically by fullname (uk locale) within the same role', () => {
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

  it('is stable-equivalent: same role + same name order stays put', () => {
    const a = { posada: 'Член', fullname: 'Однакове Ім’я' };
    const b = { posada: 'Член комісії', fullname: 'Однакове Ім’я' };
    expect(compareByRoleImportance(a, b)).toBe(0);
  });
});

import { PRESENT_TEXT_FEMALE, PRESENT_TEXT_MALE } from '@/lib/constants';
import { deriveAttendees } from '@/lib/utils/protocol-attendees';
import type { GroupMemberSummary } from '@/types/group';
import type { ProtocolAttendee } from '@/types/protocol';

function member(
  userId: string,
  displayName: string,
  role: string | null = null,
): GroupMemberSummary {
  return {
    userId,
    displayName,
    role,
    joinedAt: '2024-01-01T00:00:00.000Z',
    isOwner: false,
    avatarUrl: null,
  };
}

function attendee(
  userId: string | null,
  fullname: string,
  posada: string,
  present_text: string,
): ProtocolAttendee {
  return { userId, fullname, posada, present_text };
}

// Strip the random client-side `uid` before comparing — it's a React key,
// not part of the data being tested.
function withoutUid(rows: ReturnType<typeof deriveAttendees>) {
  return rows.map((r) => ({
    userId: r.userId,
    fullname: r.fullname,
    posada: r.posada,
    present_text: r.present_text,
    isPresent: r.isPresent,
  }));
}

describe('deriveAttendees', () => {
  it('lists every current member, absent, in roster order when there is no saved protocol', () => {
    const members = [
      member('u1', 'Іваненко Іван', 'Член'),
      member('u2', 'Петренко Петро', 'Голова'),
    ];

    const result = withoutUid(deriveAttendees(members, null));

    expect(result).toEqual([
      {
        userId: 'u1',
        fullname: 'Іваненко Іван',
        posada: 'Член',
        present_text: expect.any(String),
        isPresent: false,
      },
      {
        userId: 'u2',
        fullname: 'Петренко Петро',
        posada: 'Голова',
        present_text: expect.any(String),
        isPresent: false,
      },
    ]);
  });

  it('preserves a custom saved order exactly, even though it differs from roster order', () => {
    const members = [
      member('u1', 'Іваненко Іван'),
      member('u2', 'Петренко Петро'),
      member('u3', 'Сидоренко Сидір'),
    ];
    // Saved in the reverse of roster order — as if the owner manually
    // reordered (or quick-sorted) before the last save.
    const saved: ProtocolAttendee[] = [
      attendee('u3', 'Сидоренко Сидір', 'Голова', PRESENT_TEXT_MALE),
      attendee('u2', 'Петренко Петро', 'Секретар', PRESENT_TEXT_MALE),
      attendee('u1', 'Іваненко Іван', 'Член', PRESENT_TEXT_FEMALE),
    ];

    const result = deriveAttendees(members, saved);

    expect(result.map((a) => a.userId)).toEqual(['u3', 'u2', 'u1']);
  });

  it('appends only genuinely new members (not in the saved snapshot) at the end', () => {
    const members = [
      member('u1', 'Іваненко Іван'),
      member('u2', 'Петренко Петро'),
      member('u3', 'Новенко Новак'), // joined after the last save
    ];
    const saved: ProtocolAttendee[] = [
      attendee('u2', 'Петренко Петро', 'Голова', PRESENT_TEXT_MALE),
      attendee('u1', 'Іваненко Іван', 'Секретар', PRESENT_TEXT_MALE),
    ];

    const result = deriveAttendees(members, saved);

    expect(result.map((a) => a.userId)).toEqual(['u2', 'u1', 'u3']);
    expect(result[2]).toMatchObject({ userId: 'u3', isPresent: false });
  });

  it('keeps a former member (no longer in the roster) at their saved position instead of dropping them to the end', () => {
    const members = [member('u1', 'Іваненко Іван'), member('u3', 'Сидоренко Сидір')];
    const saved: ProtocolAttendee[] = [
      attendee('u1', 'Іваненко Іван', 'Голова', PRESENT_TEXT_MALE),
      attendee('u2', 'Петренко Петро (вибув)', 'Член', PRESENT_TEXT_MALE), // left the group
      attendee('u3', 'Сидоренко Сидір', 'Секретар', PRESENT_TEXT_MALE),
    ];

    const result = deriveAttendees(members, saved);

    // 'u2' keeps its saved (middle) position rather than being shoved to the
    // end just because they're no longer a current member.
    expect(result.map((a) => a.userId)).toEqual(['u1', 'u2', 'u3']);
  });

  it('keeps a manually-added row (no userId) at its saved position, interleaved with the rest', () => {
    const members = [member('u1', 'Іваненко Іван'), member('u2', 'Петренко Петро')];
    const saved: ProtocolAttendee[] = [
      attendee('u1', 'Іваненко Іван', 'Голова', PRESENT_TEXT_MALE),
      attendee(null, 'Гість Гостьович', 'Запрошений', PRESENT_TEXT_MALE), // manually added, placed in the middle
      attendee('u2', 'Петренко Петро', 'Секретар', PRESENT_TEXT_MALE),
    ];

    const result = deriveAttendees(members, saved);

    // The old behaviour shoved every userId-less row to the very end,
    // regardless of where it had been placed — this must no longer happen.
    expect(result.map((a) => a.fullname)).toEqual([
      'Іваненко Іван',
      'Гість Гостьович',
      'Петренко Петро',
    ]);
    expect(result[1]).toMatchObject({ userId: null, fullname: 'Гість Гостьович' });
  });

  it('derives isPresent from present_text for both saved and newly-added rows', () => {
    const members = [member('u1', 'Іваненко Іван'), member('u2', 'Нова Учасниця')];
    const saved: ProtocolAttendee[] = [
      attendee('u1', 'Іваненко Іван', 'Член', PRESENT_TEXT_FEMALE), // custom/unexpected gendered text, still "present"
    ];

    const result = deriveAttendees(members, saved);

    expect(result.find((a) => a.userId === 'u1')?.isPresent).toBe(true);
    // u2 is new (not in saved), so it defaults to absent regardless of gender.
    expect(result.find((a) => a.userId === 'u2')?.isPresent).toBe(false);
  });

  it('returns an empty list when there are no members and nothing was saved', () => {
    expect(deriveAttendees([], null)).toEqual([]);
  });
});

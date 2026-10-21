import { format } from 'date-fns';

import {
  kyivDate,
  kyivTimeSlots,
  firstKyivTimeSlot,
  selectKyivDay,
  minuteInterval,
} from '@/lib/utils/kyiv-date-time';

describe('Kyiv date and time selection', () => {
  it('converts UTC instants to Kyiv wall time in summer and winter', () => {
    expect(format(kyivDate('2026-07-01T12:00:00Z')!, 'yyyy-MM-dd HH:mm')).toBe('2026-07-01 15:00');
    expect(format(kyivDate('2026-01-01T12:00:00Z')!, 'yyyy-MM-dd HH:mm')).toBe('2026-01-01 14:00');
  });
  it('treats missing and invalid values as empty', () => {
    expect(kyivDate(null)).toBeUndefined();
    expect(kyivDate('invalid')).toBeUndefined();
  });
  it('offers only minute-aligned slots inside exact inclusive bounds', () => {
    const day = new Date('2026-07-01T12:00:00Z');
    const slots = kyivTimeSlots(
      day,
      30,
      new Date('2026-07-01T10:07:30Z'),
      new Date('2026-07-01T11:00:00Z'),
    );
    expect(slots.map((slot) => new Date(slot.value).toISOString())).toEqual([
      '2026-07-01T10:30:00.000Z',
      '2026-07-01T11:00:00.000Z',
    ]);
  });
  it('disables a day when no time slot fits the limits', () => {
    expect(
      firstKyivTimeSlot(
        new Date('2026-07-01T12:00Z'),
        30,
        new Date('2026-07-01T10:01Z'),
        new Date('2026-07-01T10:29Z'),
      ),
    ).toBeUndefined();
  });
  it('omits nonexistent Kyiv times during the spring clock change', () => {
    const slots = kyivTimeSlots(new Date('2026-03-29T12:00Z'), 30);
    expect(slots).toHaveLength(46);
    expect(slots.some((slot) => slot.label.startsWith('03:'))).toBe(false);
  });
  it('distinguishes repeated autumn times by offset and UTC instant', () => {
    const slots = kyivTimeSlots(new Date('2026-10-25T12:00Z'), 30);
    expect(slots).toHaveLength(50);
    const repeated = slots.filter((slot) => slot.label.startsWith('03:00'));
    expect(repeated.map((slot) => slot.label)).toEqual(['03:00 (+03:00)', '03:00 (+02:00)']);
    expect(repeated.map((slot) => new Date(slot.value).toISOString())).toEqual([
      '2026-10-25T00:00:00.000Z',
      '2026-10-25T01:00:00.000Z',
    ]);
  });
  it('keeps the selected Kyiv clock time when choosing another date across DST', () => {
    const next = selectKyivDay(new Date('2026-03-29T12:00Z'), new Date('2026-03-28T08:00Z'), 30);
    expect(next?.toISOString()).toBe('2026-03-29T07:00:00.000Z');
  });
  it('clamps a chosen day to its nearest allowed slot', () => {
    const next = selectKyivDay(
      new Date('2026-07-01T12:00Z'),
      new Date('2026-07-01T05:00Z'),
      30,
      new Date('2026-07-01T10:07Z'),
    );
    expect(next?.toISOString()).toBe('2026-07-01T10:30:00.000Z');
  });
  it.each(['UTC', 'America/New_York', 'Asia/Tokyo'])(
    'ignores browser/system timezone %s',
    (zone) => {
      const previous = process.env.TZ;
      process.env.TZ = zone;
      try {
        expect(
          selectKyivDay(
            new Date('2026-07-02T12:00Z'),
            new Date('2026-07-01T12:00Z'),
            30,
          )?.toISOString(),
        ).toBe('2026-07-02T12:00:00.000Z');
      } finally {
        if (previous === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = previous;
        }
      }
    },
  );
  it('handles minute steps consistently, including invalid configuration', () => {
    expect(kyivTimeSlots(new Date('2026-07-01T12:00Z'), 60)).toHaveLength(24);
    expect(minuteInterval(0)).toBe(1);
    expect(minuteInterval(1.5)).toBe(1);
  });
});

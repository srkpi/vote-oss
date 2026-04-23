import { PETITION_OPEN_MONTHS } from '@/lib/constants';

/**
 * Compute the petition's close date by advancing `from` by a calendar month.
 *
 * "Calendar month" semantics: Feb 15 → Mar 15, Jan 31 → Feb 28 (clamped to
 * the last day of the target month when the source day doesn't exist).
 */
export function computePetitionClosesAt(from: Date): Date {
  const result = new Date(from);
  const targetMonth = result.getMonth() + PETITION_OPEN_MONTHS;
  result.setMonth(targetMonth);

  // setMonth rolls over when day doesn't exist in the target month (e.g.
  // Jan 31 → Mar 3).  Detect rollover and clamp to the last day of the
  // intended month instead.
  const normalisedTargetMonth = ((targetMonth % 12) + 12) % 12;
  if (result.getMonth() !== normalisedTargetMonth) {
    result.setDate(0);
  }
  return result;
}

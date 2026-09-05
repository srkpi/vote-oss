import { getGenderedAbsentText, isAttendeePresentByText } from '@/lib/utils/protocol-gender';
import type { GroupMemberSummary } from '@/types/group';
import type { ProtocolAttendee } from '@/types/protocol';

/** Editable draft of a single attendance-list row in the protocol form. */
export interface AttendeeDraft {
  /** Stable client-side id used as the React list key — never persisted. */
  uid: string;
  userId: string | null;
  fullname: string;
  posada: string;
  present_text: string;
  isPresent: boolean;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Builds the editable attendance-list drafts for the protocol form from the
 * group's current member roster plus (for an existing protocol) the
 * previously-saved attendance snapshot.
 *
 * The saved snapshot is authoritative for both content — so historical edits
 * to a name/posada remain stable even if the member's live profile changed —
 * and *order*: the owner may have manually reordered the list or applied a
 * quick-sort, and that arrangement must survive a reload rather than
 * reverting to the group's raw (join-date) member order. Every saved row
 * (whether it's tied to a current member, a former member who has since left
 * the group, or a manually-added row with no `userId`) keeps its saved
 * position. Only members who joined *after* the last save are genuinely new;
 * they have no saved position to preserve, so they're appended at the end as
 * absent rows.
 */
export function deriveAttendees(
  members: GroupMemberSummary[],
  saved: ProtocolAttendee[] | null,
): AttendeeDraft[] {
  const result: AttendeeDraft[] = [];
  const seenUserIds = new Set<string>();

  for (const s of saved ?? []) {
    if (s.userId) seenUserIds.add(s.userId);
    result.push({
      uid: uid(),
      userId: s.userId,
      fullname: s.fullname,
      posada: s.posada,
      present_text: s.present_text,
      // Use the shared helper so both "присутній" and "присутня" are detected
      isPresent: isAttendeePresentByText(s.present_text),
    });
  }

  for (const m of members) {
    if (seenUserIds.has(m.userId)) continue;
    // New member not yet in saved snapshot — derive gender-aware absent text
    result.push({
      uid: uid(),
      userId: m.userId,
      fullname: m.displayName,
      posada: m.role ?? '',
      present_text: getGenderedAbsentText(m.displayName),
      isPresent: false,
    });
  }

  return result;
}

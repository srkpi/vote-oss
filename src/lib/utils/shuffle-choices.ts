import { createHash } from 'crypto';

/**
 * Deterministically shuffle election choices for a specific user.
 *
 * Properties:
 *  - Same (userId, electionId) pair always produces the same permutation.
 *  - Different users see different permutations.
 *  - Returned `position` values are 0-based indices of the shuffled order;
 *    original positions are never exposed, making the original order
 *    unrecoverable from the response alone.
 *
 * Algorithm: seeded Fisher-Yates using SHA-256(userId + '\0' + electionId)
 * as the initial byte source, chained via H(prev_buffer) when exhausted.
 */
export function shuffleChoicesForUser<T extends { position: number }>(
  choices: T[],
  userId: string,
  electionId: string,
): T[] {
  if (choices.length <= 1) {
    return choices.map((c, i) => ({ ...c, position: i }));
  }

  let buf = createHash('sha256').update(`${userId}\x00${electionId}`).digest();
  let bufPos = 0;

  const nextByte = (): number => {
    if (bufPos >= buf.length) {
      // Chain: H(prev_buffer) provides more bytes without seed reuse
      buf = createHash('sha256').update(buf).digest();
      bufPos = 0;
    }
    return buf[bufPos++]!;
  };

  const nextUint32 = (): number =>
    ((nextByte() << 24) | (nextByte() << 16) | (nextByte() << 8) | nextByte()) >>> 0;

  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const range = i + 1;
    // Rejection sampling eliminates modulo bias
    const cap = Math.floor(0x100000000 / range) * range;
    let r: number;
    do {
      r = nextUint32();
    } while (r >= cap);
    const j = r % range;
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }

  // Overwrite positions with 0-based shuffled indices — original order is gone
  return arr.map((choice, index) => ({ ...choice, position: index }));
}

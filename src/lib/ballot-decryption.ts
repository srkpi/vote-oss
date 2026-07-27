import { DECRYPTION_BATCH_SIZE } from '@/lib/constants';
import { decryptBallotData, importPrivateKey } from '@/lib/crypto';
import type { Ballot, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';

interface DecryptBallotsParams {
  ballots: Ballot[];
  privateKey: string;
  choices: ElectionChoice[];
  signal?: AbortSignal;
}

/**
 * Decrypts an entire list of ballots against the election's private key.
 *
 * Hash-chain validation compares each ballot to the one immediately before
 * it, so we need the *actual* chain order first. We don't trust the array's
 * incoming order for that — analytics-compute.ts doesn't either (see its
 * `sortedBallots`) — so we sort by `createdAt` ourselves before walking
 * the chain, instead of relying on whatever order the API responded with.
 */
export async function decryptBallots({
  ballots,
  privateKey,
  choices,
  signal,
}: DecryptBallotsParams): Promise<DecryptedMap> {
  const map: DecryptedMap = new Map();
  if (ballots.length === 0) return map;

  const key = await importPrivateKey(privateKey);

  const chainOrdered = [...ballots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (let i = 0; i < chainOrdered.length; i += DECRYPTION_BATCH_SIZE) {
    if (signal?.aborted) return map;

    const batch = chainOrdered.slice(i, i + DECRYPTION_BATCH_SIZE);

    await Promise.all(
      batch.map(async (ballot, batchIndex) => {
        const absoluteIndex = i + batchIndex;
        const prevBallot = absoluteIndex > 0 ? chainOrdered[absoluteIndex - 1] : null;
        map.set(ballot.id, await decryptSingleBallot(key, ballot, prevBallot, choices));
      }),
    );

    // Yield to the main thread between batches to keep the UI responsive.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return map;
}

async function decryptSingleBallot(
  key: CryptoKey,
  ballot: Ballot,
  prevBallot: Ballot | null,
  choices: ElectionChoice[],
) {
  const hashValid = prevBallot
    ? ballot.previousHash === prevBallot.currentHash
    : ballot.previousHash === null;

  let choiceIds: string[] | null = null;
  let choiceLabels: string[] | null = null;
  let valid = false;
  let voter = null;

  try {
    const decrypted = await decryptBallotData(key, ballot.encryptedBallot);

    if (decrypted !== null) {
      const decryptedIds = decrypted.choiceIds || [];
      const validIds = decryptedIds.filter((id) => choices.some((c) => c.id === id));

      if (validIds.length === decryptedIds.length && validIds.length > 0) {
        choiceIds = validIds;
        choiceLabels = validIds.map((id) => choices.find((c) => c.id === id)?.choice ?? id);
        valid = true;
      }

      if (decrypted.voter) {
        voter = decrypted.voter;
      }
    }
  } catch {
    // Per-ballot decryption failure gracefully falls back to the default invalid state.
  }

  return { choiceIds, choiceLabels, valid, hashValid, voter };
}

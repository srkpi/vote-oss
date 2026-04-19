import {
  WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE,
  WINNING_CONDITION_PERCENTAGE_MIN,
  WINNING_CONDITION_QUORUM_MAX,
  WINNING_CONDITION_QUORUM_MIN,
  WINNING_CONDITION_VOTES_MAX,
  WINNING_CONDITION_VOTES_MIN,
} from '@/lib/constants';
import type { WinningConditions } from '@/types/election';
import {
  DEFAULT_WINNING_CONDITIONS,
  DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE,
} from '@/types/election';

/**
 * Safely parse a raw DB JSON value into a WinningConditions object.
 * Falls back to DEFAULT_WINNING_CONDITIONS for any missing / invalid fields.
 */
export function parseWinningConditions(raw: unknown): WinningConditions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WINNING_CONDITIONS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    hasMostVotes: typeof obj.hasMostVotes === 'boolean' ? obj.hasMostVotes : true,
    reachesPercentage: typeof obj.reachesPercentage === 'number' ? obj.reachesPercentage : null,
    reachesVotes: typeof obj.reachesVotes === 'number' ? obj.reachesVotes : null,
    quorum: typeof obj.quorum === 'number' ? obj.quorum : null,
  };
}

/**
 * Validate and normalise a winning-conditions body fragment received from an
 * API request.  Returns a validated WinningConditions object, or an error
 * string describing the first validation failure.
 */
export function validateWinningConditions(
  body: unknown,
  choicesLength: number,
): WinningConditions | string {
  if (body === null || body === undefined) {
    if (choicesLength === 1) {
      return { ...DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE };
    }
    return { ...DEFAULT_WINNING_CONDITIONS };
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return 'winningConditions must be an object';
  }

  const obj = body as Record<string, unknown>;

  const hasMostVotes = obj.hasMostVotes === undefined ? false : Boolean(obj.hasMostVotes);
  if (choicesLength === 1 && hasMostVotes) {
    return `hasMostVote is not allowed for elections with one choice`;
  }

  // reachesPercentage: [0, 100)
  let reachesPercentage: number | null = null;
  if (obj.reachesPercentage !== null && obj.reachesPercentage !== undefined) {
    if (choicesLength === 1) {
      return `reachesPercentage is not allowed for elections with one choice`;
    }

    const val = Number(obj.reachesPercentage);
    if (
      isNaN(val) ||
      val < WINNING_CONDITION_PERCENTAGE_MIN ||
      val >= WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE
    ) {
      return (
        `reachesPercentage must be at least ${WINNING_CONDITION_PERCENTAGE_MIN} ` +
        `and less than ${WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE}`
      );
    }
    reachesPercentage = val;
  }

  // reachesVotes: [1, 10_000]
  let reachesVotes: number | null = null;
  if (obj.reachesVotes !== null && obj.reachesVotes !== undefined) {
    if (choicesLength === 1) {
      return `reachesVotes is not allowed for elections with one choice, use quorum instead`;
    }

    const val = Number(obj.reachesVotes);
    if (
      !Number.isInteger(val) ||
      val < WINNING_CONDITION_VOTES_MIN ||
      val > WINNING_CONDITION_VOTES_MAX
    ) {
      return (
        `reachesVotes must be an integer between ` +
        `${WINNING_CONDITION_VOTES_MIN} and ${WINNING_CONDITION_VOTES_MAX}`
      );
    }
    reachesVotes = val;
  }

  // quorum: [1, 10_000]
  let quorum: number | null = null;
  if (obj.quorum !== null && obj.quorum !== undefined) {
    const val = Number(obj.quorum);
    if (
      !Number.isInteger(val) ||
      val < WINNING_CONDITION_QUORUM_MIN ||
      val > WINNING_CONDITION_QUORUM_MAX
    ) {
      return (
        `quorum must be an integer between ` +
        `${WINNING_CONDITION_QUORUM_MIN} and ${WINNING_CONDITION_QUORUM_MAX}`
      );
    }
    quorum = val;
  }

  if (!hasMostVotes && reachesPercentage === null && reachesVotes === null && quorum === null) {
    return 'At least one winning condition must be set';
  }

  return { hasMostVotes, reachesPercentage, reachesVotes, quorum };
}

/**
 * Determine which choice IDs win given a vote tally, total ballots cast, and
 * winning conditions.
 *
 * Rules:
 *  1. If quorum is set and totalBallots < quorum → no winners.
 *  2. If hasMostVotes is set and maxVotes === 0 → no winners (no votes cast).
 *  3. For each option ALL enabled conditions must be satisfied.
 *  4. Ties: multiple options can simultaneously satisfy all conditions.
 */
export function computeWinners(
  tally: Record<string, number>,
  totalBallots: number,
  conditions: WinningConditions,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  // Quorum gate — nobody wins if quorum not met
  if (conditions.quorum !== null && totalBallots < conditions.quorum) {
    for (const id of Object.keys(tally)) result[id] = false;
    return result;
  }

  const maxVotes = Math.max(0, ...Object.values(tally));

  for (const [id, votes] of Object.entries(tally)) {
    let winner = true;

    // Condition 1: has the most votes — also requires at least one vote cast
    if (conditions.hasMostVotes && (maxVotes === 0 || votes !== maxVotes)) {
      winner = false;
    }

    // Condition 2: reaches more than X% of total ballots
    if (winner && conditions.reachesPercentage !== null) {
      const pct = totalBallots > 0 ? (votes / totalBallots) * 100 : 0;
      if (pct <= conditions.reachesPercentage) winner = false;
    }

    // Condition 3: reaches at least X votes
    if (winner && conditions.reachesVotes !== null && votes < conditions.reachesVotes) {
      winner = false;
    }

    result[id] = winner;
  }

  return result;
}

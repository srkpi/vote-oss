'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { decryptBallots } from '@/lib/ballot-decryption';
import type { Ballot, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';

export type DecryptionStatus = 'idle' | 'decrypting' | 'done' | 'unavailable';

interface UseBallotDecryptionOptions {
  ballots: Ballot[];
  privateKey: string | null | undefined;
  choices: ElectionChoice[];
}

interface UseBallotDecryptionResult {
  decryptedMap: DecryptedMap;
  status: DecryptionStatus;
  isDecrypting: boolean;
  decryptionDone: boolean;
  decrypt: () => void;
}

export function useBallotDecryption({
  ballots,
  privateKey,
  choices,
}: UseBallotDecryptionOptions): UseBallotDecryptionResult {
  const [decryptedMap, setDecryptedMap] = useState<DecryptedMap>(new Map());
  const [status, setStatus] = useState<DecryptionStatus>('idle');
  const statusRef = useRef<DecryptionStatus>('idle');

  // `decrypt` needs the freshest ballots/key/choices but shouldn't change
  // identity every render (it's handed to child components as a prop) — a
  // ref keeps it stable while still reading live values when called.
  const latestRef = useRef({ ballots, privateKey, choices });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    latestRef.current = { ballots, privateKey, choices };
  }, [ballots, privateKey, choices]);

  // New ballot data (a different election, or the key becoming
  // available/unavailable) invalidates any previous run. We reset to
  // 'idle' rather than re-decrypting automatically — the caller decides
  // when to trigger it again.
  useEffect(() => {
    abortRef.current?.abort();
    statusRef.current = 'idle';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDecryptedMap(new Map());
    setStatus('idle');
  }, [ballots, privateKey]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const decrypt = useCallback(() => {
    if (statusRef.current !== 'idle') return;

    const { ballots, privateKey, choices } = latestRef.current;

    if (!privateKey) {
      // No key available (private/ongoing election, no permission, etc.) —
      // nothing was verified, so this must NOT be treated as `done`:
      // callers gating an integrity banner on `decryptionDone` rely on
      // that distinction.
      statusRef.current = 'unavailable';
      setStatus('unavailable');
      return;
    }

    if (ballots.length === 0) {
      statusRef.current = 'done';
      setDecryptedMap(new Map());
      setStatus('done');
      return;
    }

    statusRef.current = 'decrypting';
    setStatus('decrypting');

    const controller = new AbortController();
    abortRef.current = controller;

    decryptBallots({ ballots, privateKey, choices, signal: controller.signal })
      .then((map) => {
        if (controller.signal.aborted) return;
        setDecryptedMap(map);
        statusRef.current = 'done';
        setStatus('done');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Failed to decrypt ballots:', err);
        setDecryptedMap(new Map());
        statusRef.current = 'done';
        setStatus('done');
      });
  }, []);

  return {
    decryptedMap,
    status,
    isDecrypting: status === 'decrypting',
    decryptionDone: status === 'done',
    decrypt,
  };
}

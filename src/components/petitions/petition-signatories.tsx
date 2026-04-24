'use client';

import { Loader2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { LocalDateTime } from '@/components/ui/local-time';
import { decryptBallotData, importPrivateKey, verifyBallotHash } from '@/lib/crypto';
import { pluralize } from '@/lib/utils/common';
import type { PetitionSignatoriesResponse } from '@/types/ballot';

interface Signatory {
  ballotId: string;
  userId: string;
  fullName: string;
  signedAt: string;
  hashValid: boolean;
}

interface PetitionSignatoriesProps {
  ballotCount: number;
  initialData: PetitionSignatoriesResponse | null;
  fetchError: string | null;
}

export function PetitionSignatories({
  ballotCount,
  initialData,
  fetchError,
}: PetitionSignatoriesProps) {
  const [signatories, setSignatories] = useState<Signatory[] | null>(null);
  const [malformedCount, setMalformedCount] = useState(0);
  const [invalidHashCount, setInvalidHashCount] = useState(0);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignatories(null);
      return;
    }

    const { petition, ballots } = initialData;
    let cancelled = false;

    (async () => {
      if (ballots.length === 0) {
        if (!cancelled) {
          setSignatories([]);
          setMalformedCount(0);
          setInvalidHashCount(0);
          setDecryptError(null);
        }
        return;
      }

      let key: CryptoKey;
      try {
        key = await importPrivateKey(petition.privateKey);
      } catch (err) {
        console.error('[petition] Failed to import private key', err);
        if (!cancelled) {
          setSignatories([]);
          setDecryptError('Не вдалося завантажити ключ для розшифрування підписів.');
        }
        return;
      }

      const result: Signatory[] = [];
      let malformed = 0;
      let invalidHash = 0;

      const BATCH = 8;
      for (let i = 0; i < ballots.length; i += BATCH) {
        const slice = await Promise.all(
          ballots.slice(i, i + BATCH).map(async (b) => {
            const [decrypted, hashValid] = await Promise.all([
              decryptBallotData(key, b.encryptedBallot),
              verifyBallotHash(b, petition.id),
            ]);
            return { ballot: b, decrypted, hashValid };
          }),
        );
        if (cancelled) return;
        for (const { ballot, decrypted, hashValid } of slice) {
          if (!hashValid) invalidHash += 1;
          if (decrypted?.voter) {
            result.push({
              ballotId: ballot.id,
              userId: decrypted.voter.userId,
              fullName: decrypted.voter.fullName,
              signedAt: ballot.createdAt,
              hashValid,
            });
          } else {
            malformed += 1;
          }
        }
      }

      if (!cancelled) {
        setSignatories(result);
        setMalformedCount(malformed);
        setInvalidHashCount(invalidHash);
        setDecryptError(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  const total = signatories?.length ?? ballotCount;

  return (
    <div className="border-border-color shadow-shadow-sm min-w-0 rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center gap-3 border-b px-5 py-4">
        <div className="bg-surface text-kpi-navy flex h-8 w-8 items-center justify-center rounded-lg">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-foreground text-base font-semibold">Підписанти</p>
          <p className="font-body text-muted-foreground text-xs">
            {total} {pluralize(total, ['підписант', 'підписанти', 'підписантів'], false)}
          </p>
        </div>
      </div>

      {fetchError ? (
        <div className="font-body border-error/20 bg-error-bg text-error flex items-center gap-2 px-5 py-4 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Не вдалося завантажити підписантів: {fetchError}</span>
        </div>
      ) : !initialData || signatories === null ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="text-kpi-navy h-5 w-5 animate-spin" />
        </div>
      ) : decryptError ? (
        <div className="font-body border-error/20 bg-error-bg text-error flex items-center gap-2 px-5 py-4 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{decryptError}</span>
        </div>
      ) : signatories.length === 0 && initialData.ballots.length === 0 ? (
        <p className="font-body text-muted-foreground px-5 py-8 text-center text-sm">
          Петицію ще ніхто не підписав.
        </p>
      ) : (
        <>
          {invalidHashCount === 0 && malformedCount === 0 ? (
            <div className="font-body border-success/20 bg-success-bg text-success flex items-center gap-2 border-b px-5 py-3 text-sm">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Ланцюжок підписів цілісний — усі хеші вірні</span>
            </div>
          ) : (
            <div className="font-body border-error/20 bg-error-bg text-error flex flex-col gap-1 border-b px-5 py-3 text-sm">
              {invalidHashCount > 0 && (
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{invalidHashCount}</strong>{' '}
                    {pluralize(invalidHashCount, ['підпис', 'підписи', 'підписів'], false)} мають
                    некоректний хеш
                  </span>
                </div>
              )}
              {malformedCount > 0 && (
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{malformedCount}</strong>{' '}
                    {pluralize(malformedCount, ['підпис', 'підписи', 'підписів'], false)} не вдалося
                    розшифрувати
                  </span>
                </div>
              )}
            </div>
          )}

          {signatories.length === 0 ? (
            <p className="font-body text-muted-foreground px-5 py-8 text-center text-sm">
              Жодного підпису не вдалося розшифрувати.
            </p>
          ) : (
            <ul className="divide-border-subtle divide-y">
              {signatories.map((s) => (
                <li key={s.ballotId} className="flex items-center gap-3 px-5 py-3">
                  <div className="navy-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
                    {s.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-foreground truncate text-sm font-medium">
                      {s.fullName}
                    </p>
                    <p className="font-body text-muted-foreground mt-0.5 text-xs">
                      <LocalDateTime date={s.signedAt} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

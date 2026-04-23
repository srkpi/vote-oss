'use client';

import { Loader2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { LocalDateTime } from '@/components/ui/local-time';
import { api } from '@/lib/api/browser';
import { pluralize } from '@/lib/utils/common';

interface Signatory {
  userId: string;
  fullName: string;
  signedAt: string;
}

interface PetitionSignatoriesProps {
  petitionId: string;
  ballotCount: number;
}

export function PetitionSignatories({ petitionId, ballotCount }: PetitionSignatoriesProps) {
  const [signatories, setSignatories] = useState<Signatory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.elections.getSignatories(petitionId);
      if (cancelled) return;
      if (res.success) {
        setSignatories(res.data.signatories);
      } else {
        setError(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [petitionId, ballotCount]);

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

      {signatories === null && !error ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="text-kpi-navy h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="font-body text-muted-foreground px-5 py-8 text-center text-sm">
          Не вдалося завантажити список підписантів.
        </p>
      ) : signatories && signatories.length === 0 ? (
        <p className="font-body text-muted-foreground px-5 py-8 text-center text-sm">
          Петицію ще ніхто не підписав.
        </p>
      ) : (
        <ul className="divide-border-subtle divide-y">
          {signatories!.map((s) => (
            <li key={s.userId + s.signedAt} className="flex items-center gap-3 px-5 py-3">
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
    </div>
  );
}

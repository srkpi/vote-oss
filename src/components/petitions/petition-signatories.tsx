'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { LocalDateTime } from '@/components/ui/local-time';
import { Pagination } from '@/components/ui/pagination';
import { useAvatar } from '@/hooks/use-avatar';
import { ensureAvatars } from '@/lib/avatar-store';
import { SIGNATORIES_PAGE_SIZE } from '@/lib/constants';
import type { BallotsResponse, DecryptedMap } from '@/types/ballot';

interface Signatory {
  ballotId: string;
  userId: string;
  fullName: string;
  signedAt: string;
  hashValid: boolean;
}

interface PetitionSignatoriesProps {
  electionId: string;
  initialData: BallotsResponse | null;
  fetchError: string | null;
  decryptedMap: DecryptedMap;
  decryptionDone: boolean;
}

export function PetitionSignatories({
  initialData,
  fetchError,
  decryptedMap,
  decryptionDone,
}: PetitionSignatoriesProps) {
  const [page, setPage] = useState(1);

  const signatories: Signatory[] = useMemo(() => {
    if (!initialData || !decryptionDone) return [];
    const results: Signatory[] = [];
    for (const ballot of initialData.ballots) {
      const dec = decryptedMap.get(ballot.id);
      if (dec?.valid && dec.voter) {
        results.push({
          ballotId: ballot.id,
          userId: dec.voter.userId,
          fullName: dec.voter.fullName,
          signedAt: ballot.createdAt,
          hashValid: dec.hashValid,
        });
      }
    }
    return results;
  }, [initialData, decryptedMap, decryptionDone]);

  useEffect(() => {
    if (signatories.length > 0) {
      ensureAvatars(signatories.map((s) => s.userId));
    }
  }, [signatories]);

  if (fetchError) {
    return (
      <Alert variant="error" title="Не вдалося завантажити підписантів">
        {fetchError}
      </Alert>
    );
  }

  if (!decryptionDone) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="text-kpi-navy h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(signatories.length / SIGNATORIES_PAGE_SIZE));
  const pageItems = signatories.slice(
    (page - 1) * SIGNATORIES_PAGE_SIZE,
    page * SIGNATORIES_PAGE_SIZE,
  );

  if (signatories.length === 0) {
    return <p className="text-muted-foreground text-sm">Ще немає підписантів.</p>;
  }

  return (
    <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
      <div className="divide-border-color divide-y">
        {pageItems.map((signatory) => (
          <SignatoryRow key={signatory.ballotId} signatory={signatory} />
        ))}
      </div>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
    </div>
  );
}

function SignatoryRow({ signatory }: { signatory: Signatory }) {
  const avatarUrl = useAvatar(signatory.userId);

  return (
    <div
      className="flex items-center gap-3 py-2.5"
      title={signatory.hashValid ? undefined : 'Порушено цілісність ланцюга бюлетенів'}
    >
      <Avatar src={avatarUrl} name={signatory.fullName} size={24} />
      <span className="min-w-0 flex-1 truncate text-sm">{signatory.fullName}</span>
      <LocalDateTime date={signatory.signedAt} className="text-muted-foreground shrink-0 text-xs" />
    </div>
  );
}

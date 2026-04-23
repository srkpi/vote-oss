'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { computeNullifierClient, encryptBallotClient } from '@/lib/crypto';
import { getVote, saveVote } from '@/lib/vote-storage';
import type { ElectionDetail } from '@/types/election';

interface SignPetitionPanelProps {
  petition: ElectionDetail;
}

export function SignPetitionPanel({ petition }: SignPetitionPanelProps) {
  const { toast } = useToast();
  const [alreadySigned, setAlreadySigned] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlreadySigned(petition.hasVoted || !!getVote(petition.id));
  }, [petition.id, petition.hasVoted]);

  if (alreadySigned === null) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="text-kpi-navy h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="border-success/30 bg-success-bg flex items-center gap-3 rounded-xl border p-4">
        <CheckCircle2 className="text-success h-6 w-6 shrink-0" />
        <div>
          <p className="font-display text-foreground font-semibold">Ви підписали цю петицію</p>
          <p className="font-body text-muted-foreground text-sm">Дякуємо за вашу підтримку!</p>
        </div>
      </div>
    );
  }

  const handleSign = async () => {
    const choice = petition.choices[0];
    if (!choice) {
      setError('У петиції немає варіанту підтримки');
      return;
    }

    setSubmitting(true);
    setError(null);

    const tokenResult = await api.elections.getVoteToken(petition.id);
    if (!tokenResult.success) {
      setError(tokenResult.error);
      setSubmitting(false);
      return;
    }

    const { token, signature, voterIdentity } = tokenResult.data;
    if (!voterIdentity) {
      setError('Не вдалося отримати особу підписанта.');
      setSubmitting(false);
      return;
    }

    let encryptedBallot: string;
    let nullifier: string;
    try {
      encryptedBallot = await encryptBallotClient(
        petition.publicKey,
        [choice.id],
        petition.maxChoices,
        voterIdentity,
      );
      nullifier = await computeNullifierClient(token);
    } catch {
      setError('Помилка шифрування підпису. Спробуйте знову.');
      setSubmitting(false);
      return;
    }

    const result = await api.elections.submitBallot(petition.id, {
      token,
      signature,
      encryptedBallot,
      nullifier,
    });

    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    saveVote({
      electionId: petition.id,
      choiceIds: [choice.id],
      choiceLabels: [choice.choice],
      ballotHash: result.data.ballotHash,
      votedAt: new Date().toISOString(),
    });

    setAlreadySigned(true);
    toast({
      title: 'Петицію підписано',
      description: 'Дякуємо за вашу підтримку!',
      variant: 'success',
      duration: 6000,
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert variant="warning" title="Петиція не анонімна">
        Ваші ПІБ та ідентифікатор будуть зашифровано разом із підписом та стануть відомі всім, хто
        переглядає підписи петиції.
      </Alert>

      <Button variant="accent" size="lg" fullWidth loading={submitting} onClick={handleSign}>
        Підтримати петицію
      </Button>
    </div>
  );
}

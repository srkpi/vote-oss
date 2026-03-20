'use client';

import { ChevronRight, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { ChoiceButton } from '@/components/elections/choice-button';
import { ConfirmChoice } from '@/components/elections/confirm-choice';
import { VotingSuccess } from '@/components/elections/voting-success';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { computeNullifierClient, encryptChoiceClient } from '@/lib/crypto';
import { saveVote } from '@/lib/vote-storage';
import type { ElectionChoice, ElectionDetail } from '@/types/election';
import type { VoteToken } from '@/types/vote';

interface VoteFormProps {
  election: ElectionDetail;
}

export function VoteForm({ election }: VoteFormProps) {
  const { toast } = useToast();

  const [selectedChoice, setSelectedChoice] = useState<ElectionChoice | null>(null);
  const [step, setStep] = useState<'select' | 'confirm' | 'submitting' | 'done'>('select');
  const [ballotHash, setBallotHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voteTokenRef = useRef<VoteToken>(null);

  const handleSubmit = async () => {
    if (!selectedChoice) return;
    setStep('submitting');
    setError(null);

    // Get vote token from server
    if (!voteTokenRef.current) {
      const tokenResult = await api.getVoteToken(election.id);
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setStep('confirm');
        return;
      }

      const voteToken = tokenResult.data;
      voteTokenRef.current = voteToken;
    }

    const { token, signature } = voteTokenRef.current;

    // Encrypt the ballot and compute nullifier client-side.
    let encryptedBallot: string;
    let nullifier: string;

    try {
      encryptedBallot = await encryptChoiceClient(election.publicKey, selectedChoice.id);
      nullifier = await computeNullifierClient(token);
    } catch {
      setError('Помилка шифрування бюлетеня. Спробуйте знову.');
      setStep('confirm');
      return;
    }

    // Submit the ballot
    const ballotResult = await api.submitBallot(election.id, {
      token,
      signature,
      encryptedBallot,
      nullifier,
    });

    if (!ballotResult.success) {
      setError(ballotResult.error);
      setStep('confirm');
      return;
    }

    const hash = ballotResult.data.ballotHash;

    // Persist vote locally so the user can see it on future visits
    saveVote({
      electionId: election.id,
      choiceId: selectedChoice.id,
      choiceLabel: selectedChoice.choice,
      ballotHash: hash,
      votedAt: new Date().toISOString(),
    });

    setBallotHash(hash);
    setStep('done');
    toast({
      title: 'Голос зараховано!',
      description: 'Ваш голос успішно зафіксовано.',
      variant: 'success',
      duration: 8000,
    });
  };

  if (step === 'done' && ballotHash) {
    return <VotingSuccess hash={ballotHash} electionId={election.id} />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" title="Помилка голосування" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {step === 'select' && (
        <>
          <div className="space-y-3">
            {election.choices.map((choice, index) => (
              <ChoiceButton
                key={choice.id}
                choice={choice}
                selected={selectedChoice?.id === choice.id}
                onSelect={setSelectedChoice}
                index={index}
              />
            ))}
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!selectedChoice}
            onClick={() => setStep('confirm')}
            icon={<ChevronRight className="h-4 w-4" />}
            iconPosition="right"
          >
            Продовжити
          </Button>

          <p className="font-body text-center text-xs leading-relaxed text-(--muted-foreground)">
            Ваш голос зашифровано та анонімізовано. Після подання змінити вибір неможливо.
          </p>
        </>
      )}

      {step === 'confirm' && selectedChoice && (
        <ConfirmChoice
          choice={selectedChoice}
          onBack={() => setStep('select')}
          onConfirm={handleSubmit}
          loading={false}
        />
      )}

      {step === 'submitting' && (
        <div className="flex flex-col items-center gap-6 py-8">
          <Loader2 className="h-16 w-16 animate-spin text-(--kpi-navy)" />
          <div className="text-center">
            <p className="font-display text-lg font-semibold text-(--foreground)">
              Обробка голосу…
            </p>
            <p className="font-body mt-1 text-sm text-(--muted-foreground)">
              Шифруємо та записуємо ваш голос
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

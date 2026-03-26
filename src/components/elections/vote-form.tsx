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
import { computeNullifierClient, encryptBallotClient } from '@/lib/crypto';
import { saveVote } from '@/lib/vote-storage';
import type { ElectionChoice, ElectionDetail } from '@/types/election';
import type { VoteToken } from '@/types/vote';

interface VoteFormProps {
  election: ElectionDetail;
}

export function VoteForm({ election }: VoteFormProps) {
  const { toast } = useToast();
  const isMultiple = election.maxChoices > 1;

  const [selectedChoices, setSelectedChoices] = useState<ElectionChoice[]>([]);
  const [step, setStep] = useState<'select' | 'confirm' | 'submitting' | 'done'>('select');
  const [ballotHash, setBallotHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voteTokenRef = useRef<VoteToken>(null);

  const canProceed =
    selectedChoices.length >= election.minChoices && selectedChoices.length <= election.maxChoices;

  function handleSelect(choice: ElectionChoice) {
    if (isMultiple) {
      if (selectedChoices.length < election.maxChoices) {
        setSelectedChoices((prev) => [...prev, choice]);
      }
    } else {
      setSelectedChoices([choice]);
    }
  }

  function handleDeselect(choice: ElectionChoice) {
    setSelectedChoices((prev) => prev.filter((c) => c.id !== choice.id));
  }

  const handleSubmit = async () => {
    if (!canProceed) return;
    setStep('submitting');
    setError(null);

    if (!voteTokenRef.current) {
      const tokenResult = await api.getVoteToken(election.id);
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setStep('confirm');
        return;
      }
      voteTokenRef.current = tokenResult.data;
    }

    const { token, signature } = voteTokenRef.current;

    let encryptedBallot: string;
    let nullifier: string;
    try {
      encryptedBallot = await encryptBallotClient(
        election.publicKey,
        selectedChoices.map((c) => c.id),
        election.maxChoices,
      );
      nullifier = await computeNullifierClient(token);
    } catch {
      setError('Помилка шифрування бюлетеня. Спробуйте знову.');
      setStep('confirm');
      return;
    }

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
    saveVote({
      electionId: election.id,
      choiceIds: selectedChoices.map((c) => c.id),
      choiceLabels: selectedChoices.map((c) => c.choice),
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

  const selectionHint = isMultiple
    ? `Оберіть від ${election.minChoices} до ${election.maxChoices} варіантів (обрано: ${selectedChoices.length})`
    : 'Оберіть один варіант';

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" title="Помилка голосування" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {step === 'select' && (
        <>
          <p className="font-body text-muted-foreground text-sm">{selectionHint}</p>
          <div className="space-y-3">
            {election.choices.map((choice, index) => {
              const isSelected = selectedChoices.some((c) => c.id === choice.id);
              const isDisabled =
                !isSelected && isMultiple && selectedChoices.length >= election.maxChoices;
              return (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  selected={isSelected}
                  onSelect={handleSelect}
                  onDeselect={handleDeselect}
                  index={index}
                  multiple={isMultiple}
                  disabled={isDisabled}
                />
              );
            })}
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canProceed}
            onClick={() => setStep('confirm')}
            icon={<ChevronRight className="h-4 w-4" />}
            iconPosition="right"
          >
            Продовжити
          </Button>

          <p className="font-body text-muted-foreground text-center text-xs leading-relaxed">
            Ваш голос зашифровано та анонімізовано. Після подання змінити вибір неможливо.
          </p>
        </>
      )}

      {step === 'confirm' && selectedChoices.length > 0 && (
        <ConfirmChoice
          choices={selectedChoices}
          onBack={() => setStep('select')}
          onConfirm={handleSubmit}
          loading={false}
        />
      )}

      {step === 'submitting' && (
        <div className="flex flex-col items-center gap-6 py-8">
          <Loader2 className="text-kpi-navy h-16 w-16 animate-spin" />
          <div className="text-center">
            <p className="font-display text-foreground text-lg font-semibold">Обробка голосу…</p>
            <p className="font-body text-muted-foreground mt-1 text-sm">
              Шифруємо та записуємо ваш голос
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

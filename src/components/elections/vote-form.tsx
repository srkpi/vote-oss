'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, HelpCircle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { getVoteToken, submitBallot } from '@/lib/api-client';
import { saveVote } from '@/lib/vote-storage';
import type { ElectionDetail, ElectionChoice } from '@/types';

interface VoteFormProps {
  election: ElectionDetail;
}

export function VoteForm({ election }: VoteFormProps) {
  const { toast } = useToast();

  const [selectedChoice, setSelectedChoice] = useState<ElectionChoice | null>(null);
  const [step, setStep] = useState<'select' | 'confirm' | 'submitting' | 'done'>('select');
  const [ballotHash, setBallotHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedChoice) return;
    setStep('submitting');
    setError(null);

    // Step 1: Get vote token from server
    const tokenResult = await getVoteToken(election.id);
    if (!tokenResult.success) {
      setError(tokenResult.error);
      setStep('confirm');
      return;
    }

    const { token, signature } = tokenResult.data;

    // Step 2: Encrypt the ballot and compute nullifier client-side
    let encryptedBallot: string;
    let nullifier: string;

    try {
      encryptedBallot = await encryptChoice(election.publicKey, selectedChoice.id);
      nullifier = await computeNullifier(token);
    } catch {
      setError('Помилка шифрування бюлетеня. Спробуйте знову.');
      setStep('confirm');
      return;
    }

    // Step 3: Submit the ballot
    const ballotResult = await submitBallot(election.id, {
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
            icon={<ChevronRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Продовжити
          </Button>

          <p className="text-xs text-[var(--muted-foreground)] text-center font-body leading-relaxed">
            Ваш голос зашифровано та анонімізовано. Після подання змінити вибір неможливо.
          </p>
        </>
      )}

      {step === 'confirm' && selectedChoice && (
        <ConfirmationStep
          choice={selectedChoice}
          onBack={() => setStep('select')}
          onConfirm={handleSubmit}
          loading={false}
        />
      )}

      {step === 'submitting' && <SubmittingStep />}
    </div>
  );
}

// ==================== CHOICE BUTTON ====================

interface ChoiceButtonProps {
  choice: ElectionChoice;
  selected: boolean;
  onSelect: (choice: ElectionChoice) => void;
  index: number;
}

function ChoiceButton({ choice, selected, onSelect, index }: ChoiceButtonProps) {
  return (
    <button
      onClick={() => onSelect(choice)}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-[var(--radius-lg)]',
        'border-2 transition-all duration-200 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kpi-blue-light)] focus-visible:ring-offset-2',
        'animate-fade-up',
        selected
          ? 'border-[var(--kpi-navy)] bg-[var(--kpi-navy)]/5 shadow-[var(--shadow-card)]'
          : 'border-[var(--border-color)] bg-white hover:border-[var(--kpi-blue-light)]/50 hover:bg-[var(--surface)]',
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      {/* Radio indicator */}
      <div
        className={cn(
          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all duration-200',
          selected
            ? 'border-[var(--kpi-navy)] bg-[var(--kpi-navy)]'
            : 'border-[var(--border-color)] bg-white',
        )}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>

      {/* Choice letter */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          'font-display text-base font-bold transition-all duration-200',
          selected
            ? 'bg-[var(--kpi-navy)] text-white'
            : 'bg-[var(--surface)] text-[var(--kpi-gray-mid)]',
        )}
      >
        {String.fromCharCode(65 + choice.position)}
      </div>

      {/* Text */}
      <span
        className={cn(
          'flex-1 font-body text-sm font-medium transition-colors duration-200',
          selected ? 'text-[var(--kpi-navy)]' : 'text-[var(--foreground)]',
        )}
      >
        {choice.choice}
      </span>
    </button>
  );
}

// ==================== CONFIRMATION STEP ====================

interface ConfirmationStepProps {
  choice: ElectionChoice;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function ConfirmationStep({ choice, onBack, onConfirm, loading }: ConfirmationStepProps) {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-[var(--kpi-navy)]/10 border-2 border-[var(--kpi-navy)]/20 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-[var(--kpi-navy)]" />
        </div>
        <h4 className="font-display text-xl font-semibold text-[var(--foreground)]">
          Підтвердіть свій вибір
        </h4>
        <p className="text-sm text-[var(--muted-foreground)] font-body">
          Після підтвердження змінити голос неможливо
        </p>
      </div>

      <div
        className={cn(
          'p-5 rounded-[var(--radius-lg)]',
          'bg-[var(--kpi-navy)]/5 border-2 border-[var(--kpi-navy)]/20',
        )}
      >
        <p className="text-xs text-[var(--muted-foreground)] mb-1 font-body uppercase tracking-wider">
          Ваш вибір:
        </p>
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[var(--kpi-navy)] text-white flex items-center justify-center font-display font-bold text-base shrink-0">
            {String.fromCharCode(65 + choice.position)}
          </span>
          <span className="font-body font-semibold text-[var(--kpi-navy)]">{choice.choice}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" fullWidth onClick={onBack} disabled={loading}>
          Змінити
        </Button>
        <Button
          variant="accent"
          size="lg"
          fullWidth
          onClick={onConfirm}
          loading={loading}
          icon={<Check className="w-4 h-4" />}
        >
          Підтвердити голос
        </Button>
      </div>
    </div>
  );
}

// ==================== SUBMITTING STEP ====================

function SubmittingStep() {
  return (
    <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
      <Loader2 className="w-16 h-16 text-[var(--kpi-navy)] animate-spin" />
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-[var(--foreground)]">
          Обробка голосу…
        </p>
        <p className="text-sm text-[var(--muted-foreground)] font-body mt-1">
          Шифруємо та записуємо ваш голос
        </p>
      </div>
    </div>
  );
}

// ==================== SUCCESS ====================

function VotingSuccess({ hash, electionId }: { hash: string; electionId: number }) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center text-center gap-6 py-4 animate-scale-in">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-[var(--success-bg)] border-2 border-[var(--success)]/30 flex items-center justify-center">
          <Check className="w-10 h-10 text-[var(--success)]" />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-display text-2xl font-semibold text-[var(--foreground)]">
          Голос зараховано!
        </h4>
        <p className="text-sm text-[var(--muted-foreground)] font-body">
          Ваш голос успішно зафіксовано. Вибір та хеш збережено у вашому браузері.
        </p>
      </div>

      <div className="w-full p-4 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--muted-foreground)] mb-1.5 font-body">
          Хеш бюлетеня (для перевірки):
        </p>
        <p className="font-mono text-xs text-[var(--foreground)] break-all leading-relaxed">
          {hash}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Button variant="primary" fullWidth onClick={() => router.push(`/elections`)}>
          До сторінки опитувань
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => router.push(`/elections/${electionId}/ballots`)}
        >
          Переглянути бюлетені
        </Button>
      </div>
    </div>
  );
}

// ==================== CRYPTO HELPERS (Browser-side) ====================

async function encryptChoice(publicKeyPem: string, choiceId: number): Promise<string> {
  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';
  const pemContents = publicKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s+/g, '');

  const binaryDer = atob(pemContents);
  const binaryArray = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    binaryArray[i] = binaryDer.charCodeAt(i);
  }

  const key = await window.crypto.subtle.importKey(
    'spki',
    binaryArray.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );

  const encoded = new TextEncoder().encode(String(choiceId));
  const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

async function computeNullifier(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

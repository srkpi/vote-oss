'use client';

import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import type { TeamInvitePreview } from '@/types/candidate-registration';

interface TeamAcceptClientProps {
  token: string;
  currentUserId: string;
  preview: TeamInvitePreview | null;
  loadError: string | null;
}

export function TeamAcceptClient({
  token,
  currentUserId,
  preview,
  loadError,
}: TeamAcceptClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [done, setDone] = useState<'accept' | 'reject' | null>(null);
  const [now] = useState(() => Date.now());

  if (loadError || !preview) {
    return (
      <>
        <PageHeader title="Запрошення в команду" isContainer />
        <div className="container max-w-xl py-8">
          <Alert variant="error">{loadError ?? 'Запрошення не знайдено'}</Alert>
        </div>
      </>
    );
  }

  const isCandidate = preview.candidate.userId === currentUserId;
  const expired = new Date(preview.expiresAt).getTime() <= now;
  const exhausted = preview.used || preview.revoked || expired;

  const handleAccept = async () => {
    setBusy('accept');
    const result = await api.teamInvites.accept(token);
    setBusy(null);
    if (!result.success) {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
      return;
    }
    setDone('accept');
    toast({
      title: 'Дякуємо!',
      description: 'Запрошення прийнято — очікуйте підтвердження кандидата',
      variant: 'success',
    });
    router.refresh();
  };

  const handleReject = async () => {
    setBusy('reject');
    const result = await api.teamInvites.reject(token);
    setBusy(null);
    if (!result.success) {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
      return;
    }
    setDone('reject');
    toast({ title: 'Запрошення відхилено', variant: 'success' });
    router.refresh();
  };

  return (
    <>
      <PageHeader title="Запрошення в команду" isContainer />
      <div className="container max-w-xl py-8">
        <div className="border-border-color shadow-shadow-card space-y-3 rounded-xl border bg-white p-5">
          <p className="text-foreground text-sm">
            <span className="font-semibold">{preview.candidate.fullName}</span> запрошує вас до
            команди для участі в реєстрації:
          </p>
          <div className="border-border-subtle rounded-md border p-3">
            <p className="font-display text-foreground text-base font-semibold">
              {preview.formTitle}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              Орган: {preview.groupName}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Слот: {preview.slot}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Дійсне до: <LocalDateTime date={preview.expiresAt} />
            </p>
          </div>

          {isCandidate && (
            <Alert variant="warning">
              Це ваше власне запрошення — кандидат не може прийняти його сам.
            </Alert>
          )}

          {exhausted && !done && (
            <Alert
              variant={
                preview.candidateDecision === 'CONFIRMED'
                  ? 'success'
                  : preview.candidateDecision === 'DECLINED' ||
                      preview.response === 'REJECTED' ||
                      preview.revoked
                    ? 'warning'
                    : preview.response === 'ACCEPTED'
                      ? 'info'
                      : 'warning'
              }
            >
              {preview.response === 'ACCEPTED' &&
                preview.candidateDecision === null &&
                'Ви вже прийняли це запрошення — чекаємо підтвердження кандидата.'}
              {preview.candidateDecision === 'CONFIRMED' &&
                'Кандидат підтвердив вашу участь у команді.'}
              {preview.candidateDecision === 'DECLINED' &&
                'Кандидат вирішив не включати вас у команду.'}
              {preview.response === 'REJECTED' && 'Запрошення вже було відхилено.'}
              {preview.revoked && 'Запрошення відкликане кандидатом.'}
              {expired && !preview.used && !preview.revoked && 'Термін дії запрошення минув.'}
            </Alert>
          )}

          {done === 'accept' && (
            <Alert variant="success" title="Дякуємо!">
              Запрошення прийнято. Кандидат побачить вас серед своєї команди і має підтвердити вашу
              участь — дочекайтеся підтвердження.
            </Alert>
          )}
          {done === 'reject' && <Alert variant="info">Запрошення відхилено.</Alert>}

          {!isCandidate && !exhausted && !done && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={handleAccept} loading={busy === 'accept'}>
                <CheckCircle2 className="h-4 w-4" />
                Прийняти
              </Button>
              <Button variant="outline" onClick={handleReject} loading={busy === 'reject'}>
                <XCircle className="h-4 w-4" />
                Відхилити
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

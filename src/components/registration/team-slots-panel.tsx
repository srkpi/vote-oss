'use client';

import { Check, Copy, RefreshCw, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/utils/common';
import type { TeamSlot } from '@/types/candidate-registration';

interface TeamSlotsPanelProps {
  registrationId: string;
}

interface FreshToken {
  slot: number;
  token: string;
  expiresAt: string;
}

const STATE_LABEL: Record<TeamSlot['state'], string> = {
  empty: 'Не запрошено',
  pending: 'Очікує відповіді',
  rejected: 'Відмовлено',
  expired: 'Минув термін / відкликано',
  accepted: 'Прийнято',
};

const STATE_BADGE: Record<TeamSlot['state'], string> = {
  empty: 'text-muted-foreground bg-surface',
  pending: 'text-kpi-navy bg-kpi-navy/10',
  rejected: 'text-error bg-error-bg',
  expired: 'text-muted-foreground bg-gray-100',
  accepted: 'text-success bg-success-bg',
};

export function TeamSlotsPanel({ registrationId }: TeamSlotsPanelProps) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<TeamSlot[]>([]);
  const [teamSize, setTeamSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  /** Plaintext tokens generated this session — keyed by slot. */
  const [freshTokens, setFreshTokens] = useState<Record<number, FreshToken>>({});
  const [copiedSlot, setCopiedSlot] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.registrations.team(registrationId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setSlots(res.data.slots);
        setTeamSize(res.data.teamSize);
      } else {
        setLoadError(res.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  const handleRegenerate = async (slot: number) => {
    setBusy(slot);
    const result = await api.registrations.regenerateTeamSlot(registrationId, slot);
    setBusy(null);
    if (!result.success) {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
      return;
    }
    setFreshTokens((prev) => ({ ...prev, [slot]: result.data }));
    setSlots((prev) =>
      prev.map((s) =>
        s.slot === slot
          ? { ...s, state: 'pending', expiresAt: result.data.expiresAt, member: null }
          : s,
      ),
    );
    toast({
      title: 'Посилання створено',
      description: 'Скопіюйте і надішліть члену команди — токен показано лише зараз',
      variant: 'success',
    });
  };

  const copyLink = async (slot: number, token: string) => {
    const link =
      typeof window !== 'undefined'
        ? `${window.location.origin}/registration/team-accept/${encodeURIComponent(token)}`
        : `/registration/team-accept/${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedSlot(slot);
      setTimeout(() => setCopiedSlot(null), 2000);
    } catch {
      toast({ title: 'Не вдалося скопіювати', variant: 'error' });
    }
  };

  return (
    <div className="border-border-color shadow-shadow-card mb-6 rounded-xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Users className="text-kpi-gray-mid h-4 w-4" />
        <h2 className="font-display text-foreground text-base font-semibold">
          Команда ({teamSize} {teamSize === 1 ? 'учасник' : 'учасники'})
        </h2>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        Створіть посилання для кожного слота і надішліть їх відповідним людям. Заявка перейде на
        розгляд після того, як усі слоти будуть прийняті.
      </p>

      {loading ? (
        <p className="text-muted-foreground text-sm">Завантажуємо…</p>
      ) : loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : (
        <ul className="space-y-3">
          {slots.map((s) => {
            const fresh = freshTokens[s.slot];
            const link = fresh
              ? typeof window !== 'undefined'
                ? `${window.location.origin}/registration/team-accept/${encodeURIComponent(fresh.token)}`
                : ''
              : '';
            return (
              <li key={s.slot} className="border-border-subtle rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <UserPlus className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="font-body text-foreground text-sm font-semibold">
                    Слот {s.slot}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                      STATE_BADGE[s.state],
                    )}
                  >
                    {STATE_LABEL[s.state]}
                  </span>
                  {s.expiresAt && s.state === 'pending' && (
                    <span className="text-muted-foreground text-xs">
                      до <LocalDateTime date={s.expiresAt} />
                    </span>
                  )}
                </div>
                {s.member && (
                  <p className="text-foreground mt-1 text-xs">
                    {s.state === 'accepted' ? 'Учасник: ' : 'Останній отримувач: '}
                    <span className="font-medium">{s.member.fullName || s.member.userId}</span>
                  </p>
                )}
                {fresh && (
                  <div className="mt-2 space-y-1">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      Посилання (показано лише зараз)
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="bg-surface flex-1 overflow-hidden rounded border p-2">
                        <p className="font-mono text-xs break-all select-all">{link}</p>
                      </div>
                      <Button
                        variant={copiedSlot === s.slot ? 'secondary' : 'outline'}
                        size="icon"
                        onClick={() => copyLink(s.slot, fresh.token)}
                      >
                        {copiedSlot === s.slot ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {s.state !== 'accepted' && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerate(s.slot)}
                      loading={busy === s.slot}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {s.state === 'empty' ? 'Створити посилання' : 'Згенерувати нове'}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

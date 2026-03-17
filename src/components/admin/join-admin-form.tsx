'use client';

import { Check, CheckCircle, Key, Shield, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/utils';

interface JoinAdminFormProps {
  initialToken?: string;
}

export function JoinAdminForm({ initialToken }: JoinAdminFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [token, setToken] = useState(initialToken ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    const result = await api.joinAsAdmin(trimmed);

    if (result.success) {
      await api.refreshToken();

      setSuccess(true);
      toast({
        title: 'Вітаємо!',
        description: 'Ви успішно приєднались як адміністратор.',
        variant: 'success',
        duration: 6000,
      });
      setTimeout(() => {
        router.push('/admin');
        router.refresh();
      }, 1500);
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center text-center gap-6 py-4">
        <div className="w-20 h-20 rounded-full bg-[var(--success-bg)] border-2 border-[var(--success)]/30 flex items-center justify-center">
          <Check className="w-10 h-10 text-[var(--success)]" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-2xl font-semibold text-[var(--foreground)]">
            Ласкаво просимо!
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] font-body">
            Перенаправляємо вас до адмін-панелі…
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="error" title="Помилка" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="space-y-2">
        <label
          htmlFor="token"
          className="block text-sm font-medium font-body text-[var(--foreground)]"
        >
          Токен запрошення
          <span className="ml-1 text-[var(--error)]" aria-hidden="true">
            *
          </span>
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
            <Key className="w-4 h-4" />
          </div>
          <input
            id="token"
            type="text"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setError(null);
            }}
            placeholder="Вставте токен запрошення"
            className={cn(
              'flex h-10 w-full rounded-[var(--radius)] bg-white',
              'border border-[var(--border-color)]',
              'pl-10 pr-3 py-2 text-sm font-mono text-[var(--foreground)]',
              'placeholder:text-[var(--subtle)] placeholder:font-body',
              'transition-colors duration-150',
              'hover:border-[var(--kpi-blue-light)]',
              'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
              error &&
                'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20',
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {token && !loading && (
            <button
              type="button"
              onClick={() => setToken('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] font-body">
          Токен видається чинним адміністратором системи
        </p>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
        disabled={!token.trim()}
        icon={<Shield className="w-4 h-4" />}
      >
        Приєднатися як адміністратор
      </Button>

      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <div className="space-y-2">
          {[
            'Токен є одноразовим або має обмежену кількість використань',
            'Ваші права будуть визначені адміністратором, що видав токен',
            'Після приєднання отримаєте доступ до адмін-панелі',
          ].map((item) => (
            <div
              key={item}
              className="flex items-start gap-2 text-xs text-[var(--muted-foreground)] font-body"
            >
              <CheckCircle className="w-3.5 h-3.5 text-[var(--kpi-blue-light)] shrink-0 mt-0.5" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}

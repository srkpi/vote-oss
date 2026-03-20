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
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-(--success)/30 bg-(--success-bg)">
          <Check className="h-10 w-10 text-(--success)" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-2xl font-semibold text-(--foreground)">
            Ласкаво просимо!
          </h3>
          <p className="font-body text-sm text-(--muted-foreground)">
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
        <label htmlFor="token" className="font-body block text-sm font-medium text-(--foreground)">
          Токен запрошення
          <span className="ml-1 text-(--error)" aria-hidden="true">
            *
          </span>
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--muted-foreground)">
            <Key className="h-4 w-4" />
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
              'flex h-10 w-full rounded-(--radius) bg-white',
              'border border-(--border-color)',
              'py-2 pr-3 pl-10 font-mono text-sm text-(--foreground)',
              'placeholder:font-body placeholder:text-(--subtle)',
              'transition-colors duration-150',
              'hover:border-(--kpi-blue-light)',
              'focus:border-(--kpi-blue-light) focus:ring-2 focus:ring-(--kpi-blue-light)/20 focus:outline-none',
              error && 'border-(--error) focus:border-(--error) focus:ring-(--error)/20',
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {token && !loading && (
            <button
              type="button"
              onClick={() => setToken('')}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-(--muted-foreground) transition-colors hover:text-(--foreground)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="font-body text-xs text-(--muted-foreground)">
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
        icon={<Shield className="h-4 w-4" />}
      >
        Приєднатися як адміністратор
      </Button>

      <div className="border-t border-(--border-subtle) pt-2">
        <div className="space-y-2">
          {[
            'Токен є одноразовим або має обмежену кількість використань',
            'Ваші права будуть визначені адміністратором, що видав токен',
            'Після приєднання отримаєте доступ до адмін-панелі',
          ].map((item) => (
            <div
              key={item}
              className="font-body flex items-start gap-2 text-xs text-(--muted-foreground)"
            >
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--kpi-blue-light)" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}

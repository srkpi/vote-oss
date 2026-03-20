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
        <div className="border-success/30 bg-success-bg flex h-20 w-20 items-center justify-center rounded-full border-2">
          <Check className="text-success h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-foreground text-2xl font-semibold">Ласкаво просимо!</h3>
          <p className="font-body text-muted-foreground text-sm">
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
        <label htmlFor="token" className="font-body text-foreground block text-sm font-medium">
          Токен запрошення
          <span className="text-error ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <div className="relative">
          <div className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
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
              'border-border-color border',
              'text-foreground py-2 pr-3 pl-10 font-mono text-sm',
              'placeholder:font-body placeholder:text-subtle',
              'transition-colors duration-150',
              'hover:border-kpi-blue-light',
              'focus:border-kpi-blue-light focus:ring-kpi-blue-light/20 focus:ring-2 focus:outline-none',
              error && 'border-error focus:border-error focus:ring-error/20',
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {token && !loading && (
            <button
              type="button"
              onClick={() => setToken('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="font-body text-muted-foreground text-xs">
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

      <div className="border-border-subtle border-t pt-2">
        <div className="space-y-2">
          {[
            'Токен є одноразовим або має обмежену кількість використань',
            'Ваші права будуть визначені адміністратором, що видав токен',
            'Після приєднання отримаєте доступ до адмін-панелі',
          ].map((item) => (
            <div
              key={item}
              className="font-body text-muted-foreground flex items-start gap-2 text-xs"
            >
              <CheckCircle className="text-kpi-blue-light mt-0.5 h-3.5 w-3.5 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}

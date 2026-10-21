'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, CheckCircle, Key, Shield, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { tokenRedemptionSchema } from '@/lib/schemas/group';
import { cn } from '@/lib/utils/common';

interface JoinAdminFormProps {
  initialToken?: string;
}

export function JoinAdminForm({ initialToken }: JoinAdminFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [success, setSuccess] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof tokenRedemptionSchema>>({
    resolver: zodResolver(tokenRedemptionSchema),
    defaultValues: { token: initialToken ?? '' },
  });
  const token = useWatch({ control, name: 'token' });
  const loading = isSubmitting;
  const error = errors.root?.message ?? errors.token?.message;

  const redeemToken = handleSubmit(async (values) => {
    const result = await api.admins.join(values.token);

    if (result.success) {
      await api.auth.refresh();

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
      setError('root', { message: result.error });
    }
  });

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
    <form onSubmit={redeemToken} noValidate className="space-y-5">
      {error && (
        <Alert variant="error" title="Помилка" onDismiss={() => clearErrors()}>
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
            {...register('token', { onChange: () => clearErrors('root') })}
            disabled={loading}
            placeholder="Вставте токен запрошення"
            className={cn(
              'bg-card flex h-10 w-full rounded-(--radius)',
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
              onClick={() => setValue('token', '', { shouldDirty: true, shouldValidate: true })}
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
        Приєднатися
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

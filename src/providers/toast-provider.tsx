'use client';

import type { ReactNode } from 'react';

import { ToastItem } from '@/components/ui/alert';
import { ToastProvider as ToastContextProvider, useToast } from '@/hooks/use-toast';

function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 items-end pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem
            id={t.id}
            title={t.title}
            description={t.description}
            variant={t.variant}
            onDismiss={dismiss}
          />
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastContextProvider>
      {children}
      <ToastContainer />
    </ToastContextProvider>
  );
}

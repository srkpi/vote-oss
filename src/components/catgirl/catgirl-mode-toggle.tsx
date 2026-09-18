'use client';

import { useCatgirlMode } from '@/hooks/use-catgirl-mode';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils/common';

export function CatgirlModeToggle() {
  const { enabled, toggle } = useCatgirlMode();
  const { toast } = useToast();

  const handleClick = () => {
    const next = !enabled;
    toggle();
    toast({
      title: next ? 'Catgirl-режим увімкнено! 🩷' : 'Catgirl-режим вимкнено',
      description: next ? 'Насолоджуйся рожевим світом' : undefined,
      variant: 'success',
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={handleClick}
      className={cn(
        'group flex max-w-sm items-center gap-4 rounded-full border-2 p-2 transition-colors duration-300',
        'focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:outline-none',
        enabled
          ? 'border-pink-300 bg-linear-to-r from-pink-500 to-rose-500 shadow-[0_8px_24px_-6px_rgba(219,39,119,0.55)]'
          : 'border-pink-200 bg-white hover:border-pink-300',
      )}
    >
      <span className="flex flex-col px-3 py-1.5 text-center">
        <span
          className={cn(
            'font-display text-base font-bold transition-colors duration-300',
            enabled ? 'text-white' : 'text-pink-900',
          )}
        >
          {enabled ? 'Увімкнено' : 'Вимкнено'}
        </span>
        <span
          className={cn(
            'font-body text-xs transition-colors duration-300',
            enabled ? 'text-pink-50' : 'text-pink-400',
          )}
        >
          {enabled ? 'Торкніться, щоб вимкнути' : 'Торкніться, щоб увімкнути'}
        </span>
      </span>
    </button>
  );
}

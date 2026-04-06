'use client';

import { useHydration } from '@/hooks/use-hydration';
import { cn } from '@/lib/utils';

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброго ранку';
  if (hour >= 12 && hour < 17) return 'Доброго дня';
  if (hour >= 17 && hour < 22) return 'Доброго вечора';
  return 'Лягайте спати';
};

interface AdminGreetingProps {
  name: string;
}

export function AdminGreeting({ name }: AdminGreetingProps) {
  const hydrated = useHydration();
  const greeting = hydrated ? `${getGreeting()}, ${name}!` : <span className="invisible">M</span>;

  return (
    <h1
      className={cn(
        'font-display text-foreground text-2xl font-bold sm:text-3xl',
        'transition-opacity duration-300 ease-out',
        hydrated ? 'opacity-100' : 'opacity-0',
      )}
    >
      {greeting}
    </h1>
  );
}

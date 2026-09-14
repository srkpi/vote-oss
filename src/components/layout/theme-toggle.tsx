'use client';

import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils/common';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Icon button that flips between the light and dark theme. The actual
 * theme state lives in `ThemeProvider` (see `hooks/use-theme.tsx`) — this
 * component is just a control for it, so any number of these can exist
 * (desktop header, mobile menu, admin sidebar, …) and they'll always agree.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
      title={isDark ? 'Світла тема' : 'Темна тема'}
      className={cn('text-muted-foreground hover:text-foreground', className)}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

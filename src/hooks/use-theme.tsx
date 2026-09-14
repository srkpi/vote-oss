'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { LOCAL_STORAGE_THEME_KEY } from '@/lib/constants';

export type Theme = 'light' | 'dark';

const DARK_THEME_COLOR = '#0d111a';
const LIGHT_THEME_COLOR = '#1c396e';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_THEME_KEY, next);
    } catch {
      // Theme still applies for this session even if it can't be persisted.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // As long as the user hasn't made an explicit choice, keep following the
  // OS-level preference if it changes while the app is open.
  useEffect(() => {
    if (readStoredTheme() !== null) return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const next: Theme = event.matches ? 'dark' : 'light';
      setThemeState(next);
      applyTheme(next);
    };

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

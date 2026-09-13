'use client';

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface HeroReadyContextValue {
  heroReady: boolean;
  markHeroReady: () => void;
}

const HeroReadyContext = createContext<HeroReadyContextValue | null>(null);
const FALLBACK_TIMEOUT_MS = 4000;

export function HeroReadyProvider({ children }: { children: ReactNode }) {
  const [heroReady, setHeroReady] = useState(false);
  const hasMarked = useRef(false);

  const markHeroReady = useCallback(() => {
    if (hasMarked.current) return;
    hasMarked.current = true;
    setHeroReady(true);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(markHeroReady, FALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [markHeroReady]);

  const value = useMemo(() => ({ heroReady, markHeroReady }), [heroReady, markHeroReady]);

  return <HeroReadyContext.Provider value={value}>{children}</HeroReadyContext.Provider>;
}

export function useHeroReady(): HeroReadyContextValue {
  const ctx = useContext(HeroReadyContext);
  return ctx ?? { heroReady: true, markHeroReady: () => {} };
}

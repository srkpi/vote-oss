'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { ensureCatgirlImagePoolReady } from '@/lib/catgirl/image-pool';
import { LOCAL_STORAGE_CATGIRL_MODE_KEY } from '@/lib/constants';

interface CatgirlModeContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

const CatgirlModeContext = createContext<CatgirlModeContextValue | null>(null);

function applyCatgirlClass(enabled: boolean) {
  document.documentElement.classList.toggle('catgirl', enabled);
}

export function CatgirlModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    const isEnabled = document.documentElement.classList.contains('catgirl');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabledState(isEnabled);
    if (isEnabled) ensureCatgirlImagePoolReady();
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    applyCatgirlClass(next);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_CATGIRL_MODE_KEY, next ? '1' : '0');
    } catch {}
    if (next) ensureCatgirlImagePoolReady();
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return (
    <CatgirlModeContext.Provider value={{ enabled, setEnabled, toggle }}>
      {children}
    </CatgirlModeContext.Provider>
  );
}

export function useCatgirlMode(): CatgirlModeContextValue {
  const ctx = useContext(CatgirlModeContext);
  if (!ctx) {
    throw new Error('useCatgirlMode must be used within CatgirlModeProvider');
  }
  return ctx;
}

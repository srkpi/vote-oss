'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';

import { ensureCatgirlImagePoolReady } from '@/lib/catgirl/image-pool';
import { LOCAL_STORAGE_CATGIRL_MODE_KEY } from '@/lib/constants';

interface CatgirlModeContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

const CatgirlModeContext = createContext<CatgirlModeContextValue | null>(null);

const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  return document.documentElement.classList.contains('catgirl');
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

function applyCatgirlMode(next: boolean): void {
  document.documentElement.classList.toggle('catgirl', next);
  try {
    window.localStorage.setItem(LOCAL_STORAGE_CATGIRL_MODE_KEY, next ? '1' : '0');
  } catch {}
  emitChange();
  if (next) ensureCatgirlImagePoolReady();
}

export function CatgirlModeProvider({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (enabled) ensureCatgirlImagePoolReady();
  }, [enabled]);

  const setEnabled = useCallback((next: boolean) => {
    applyCatgirlMode(next);
  }, []);

  const toggle = useCallback(() => {
    applyCatgirlMode(!enabled);
  }, [enabled]);

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

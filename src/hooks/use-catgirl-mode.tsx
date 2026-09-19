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
  /**
   * `false` on the server and during hydration, `true` from the moment the
   * real `enabled` value has been read. The server (and the hydration pass,
   * which must match it) can only render `enabled: false`, so anything
   * *React-driven* that branches on `enabled` shows the "off" UI until
   * hydration finishes — even though the `.catgirl` class is already on
   * `<html>` from `CATGIRL_INIT_SCRIPT`. UI that would visibly flip from
   * "off" to "on" should render a loader while `!ready` instead.
   */
  ready: boolean;
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

// `ready` never changes after mount, so there is nothing to subscribe to —
// it only exists to make React pick the server snapshot while hydrating and
// the client one right after, in the same pass that `enabled` gets its real
// value (which keeps the two consistent with each other).
function subscribeToNothing(): () => void {
  return () => {};
}

function getReadySnapshot(): boolean {
  return true;
}

function getServerReadySnapshot(): boolean {
  return false;
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
  const ready = useSyncExternalStore(subscribeToNothing, getReadySnapshot, getServerReadySnapshot);

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
    <CatgirlModeContext.Provider value={{ enabled, ready, setEnabled, toggle }}>
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

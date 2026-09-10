'use client';

/**
 * One-time, synchronous WebGL capability probe. Used to decide whether it's
 * worth mounting the R3F canvas at all — cheaper and more reliable than
 * waiting for a mount to fail.
 */
export function detectWebglSupport(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');

    if (!context) return false;

    // A context can be "acquired" but already lost (some virtualized CI /
    // remote-desktop environments do this) — treat that as unsupported too.
    if ('isContextLost' in context && typeof context.isContextLost === 'function') {
      return !context.isContextLost();
    }

    return true;
  } catch {
    return false;
  }
}

export type DeviceTier = 'high' | 'low';

/**
 * Coarse, heuristic device-capability tier used to pick a default render
 * quality before the first frame — real feedback (via drei's
 * `PerformanceMonitor`) can still downgrade a "high" session later, but this
 * avoids ever starting heavy (transmission material, high particle counts)
 * on a device that's obviously not going to sustain it.
 */
export function detectDeviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 'high';

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  const saveData =
    'connection' in navigator &&
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true;

  if (saveData) return 'low';
  if (coarsePointer && fewCores) return 'low';

  return 'high';
}

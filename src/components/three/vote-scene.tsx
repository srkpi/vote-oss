'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { useLazyInView } from '@/hooks/use-lazy-in-view';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';
import { detectDeviceTier, detectWebglSupport } from '@/lib/three/use-webgl-support';
import { cn } from '@/lib/utils/common';

import { usePointerParallax } from './pointer-parallax';
import { SceneErrorBoundary } from './scene-error-boundary';
import { SceneFallback } from './scene-fallback';
import type { VoteSceneVariant } from './vote-scene-canvas';

const VoteSceneCanvas = dynamic(
  () => import('./vote-scene-canvas').then((mod) => mod.VoteSceneCanvas),
  { ssr: false },
);

export interface VoteSceneProps {
  variant: VoteSceneVariant;
  className?: string;
  eager?: boolean;
}

export function VoteScene({ variant, className, eager = false }: VoteSceneProps) {
  const [containerRef, inView] = useLazyInView<HTMLDivElement>({ eager });
  const pointerRef = usePointerParallax(containerRef);
  const reducedMotion = usePrefersReducedMotion();

  const [capability, setCapability] = useState<{
    webgl: boolean;
    tier: 'high' | 'low';
  } | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [canMountCanvas, setCanMountCanvas] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCapability({ webgl: detectWebglSupport(), tier: detectDeviceTier() });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (typeof window.requestIdleCallback !== 'function') {
      const timeoutId = window.setTimeout(() => setCanMountCanvas(true), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const idleId = window.requestIdleCallback(() => setCanMountCanvas(true), { timeout: 300 });
    return () => window.cancelIdleCallback(idleId);
  }, []);

  const showRealScene =
    inView && canMountCanvas && capability !== null && capability.webgl && !reducedMotion;
  const revealed = sceneReady;

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 overflow-hidden bg-[#0a1f42]', className)}
    >
      <SceneFallback
        variant={variant}
        className={cn('transition-opacity duration-1000', revealed ? 'opacity-0' : 'opacity-100')}
      />

      {showRealScene && (
        <SceneErrorBoundary fallback={<SceneFallback variant={variant} />}>
          <div
            className={cn(
              'absolute inset-0 transition-opacity duration-1000',
              revealed ? 'opacity-100' : 'opacity-0',
            )}
          >
            <VoteSceneCanvas
              variant={variant}
              pointerRef={pointerRef}
              initialQuality={capability.tier}
              reducedMotion={reducedMotion}
              onReady={() => setSceneReady(true)}
            />
          </div>
        </SceneErrorBoundary>
      )}
    </div>
  );
}

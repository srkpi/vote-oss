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
  /** Skip the IntersectionObserver delay — use for anything above the fold. */
  eager?: boolean;
}

/**
 * Drop-in replacement for the old `AnimatedGrid`: a 3D backdrop built from
 * the real Vote OSS mark, a distributed "chain" of nodes, and an animated
 * aurora gradient, in the brand's blue palette.
 *
 * Handles everything `AnimatedGrid` didn't need to (because it was just a
 * 2D canvas): WebGL capability detection, `prefers-reduced-motion`, a
 * device-tier guess for initial render quality, lazy mounting for
 * below-the-fold placements, and a CSS-only fallback that covers the gap
 * before the real scene mounts and permanently replaces it if anything
 * above isn't available.
 */
export function VoteScene({ variant, className, eager = false }: VoteSceneProps) {
  const [containerRef, inView] = useLazyInView<HTMLDivElement>({ eager });
  const pointerRef = usePointerParallax(containerRef);
  const reducedMotion = usePrefersReducedMotion();

  const [capability, setCapability] = useState<{
    webgl: boolean;
    tier: 'high' | 'low';
  } | null>(null);
  // Separate from `capability`/`showRealScene`: those just mean "it's safe to
  // *start* mounting the real scene". `sceneReady` means the canvas has
  // actually painted a real frame, and only that should trigger the
  // fallback to fade out — otherwise there's a gap (dynamic import
  // resolving, WebGL context spinning up) where the fallback is already
  // fading to transparent but nothing opaque has replaced it yet, which
  // flashes whatever's behind this component (the page background) for a
  // frame or two.
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCapability({ webgl: detectWebglSupport(), tier: detectDeviceTier() });
  }, []);

  const showRealScene = inView && capability !== null && capability.webgl && !reducedMotion;
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

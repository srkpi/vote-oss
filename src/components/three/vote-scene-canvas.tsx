'use client';

import { PerformanceMonitor, Preload } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { type ComponentProps, useMemo, useState } from 'react';

import { AuroraBackdrop } from './backdrop-aurora';
import { ChainNetwork } from './chain-network';
import { LogoMark } from './logo-mark';
import type { PointerRef } from './pointer-parallax';
import { SceneLighting } from './scene-lighting';

export type VoteSceneVariant = 'hero' | 'aside' | 'ambient';

/** Matches Tailwind's `lg` breakpoint, used elsewhere in this app for the same desktop/mobile split (e.g. the login page's two-column layout). */
const DESKTOP_BREAKPOINT_PX = 1024;

interface VoteSceneCanvasProps {
  variant: VoteSceneVariant;
  pointerRef: PointerRef;
  initialQuality: 'high' | 'low';
  reducedMotion: boolean;
  /** Fires once the renderer exists and has painted at least one real frame — see the comment at the call site in `vote-scene.tsx` for why this matters. */
  onReady?: () => void;
}

type LogoVisibility = 'always' | 'never' | 'desktop-only';

const VARIANT_CONFIG: Record<
  VoteSceneVariant,
  {
    cameraPosition: [number, number, number];
    fov: number;
    logoScale: number;
    /** World-space offset for the logo mark — shifts it clear of a text column instead of sitting dead-center. */
    logoPosition: [number, number, number];
    /** Where that offset roughly lands in normalized pointer space, for the hover-proximity glow (see `LogoMark`). */
    logoPointerFocus: { x: number; y: number };
    logoVisibility: LogoVisibility;
    nodeCount: number;
    bounds: [number, number, number];
    bloomIntensity: number;
    showNetwork: boolean;
  }
> = {
  hero: {
    cameraPosition: [0, 0.15, 8.4],
    fov: 40,
    logoScale: 1.5,
    logoPosition: [2.1, 0, 0],
    logoPointerFocus: { x: 0.35, y: 0 },
    // On mobile the hero is narrow and stacked, so a mark shifted this far
    // right would sit half off-canvas and overlap the text — desktop only.
    logoVisibility: 'desktop-only',
    nodeCount: 34,
    bounds: [6.5, 3.4, 4],
    bloomIntensity: 0.85,
    showNetwork: false,
  },
  aside: {
    cameraPosition: [0, 0.1, 7.6],
    fov: 42,
    logoScale: 1.25,
    logoPosition: [0, 0, 0],
    logoPointerFocus: { x: 0, y: 0 },
    // The login panel's headline/branding text already fills this column
    // top-to-bottom, so a centered mark here always overlaps something —
    // off entirely, the glass/network backdrop still carries the panel.
    logoVisibility: 'never',
    nodeCount: 22,
    bounds: [4.2, 4.6, 3.2],
    bloomIntensity: 0.75,
    showNetwork: false,
  },
  ambient: {
    cameraPosition: [0, 0, 8],
    fov: 45,
    logoScale: 1,
    logoPosition: [0, 0, 0],
    logoPointerFocus: { x: 0, y: 0 },
    logoVisibility: 'never',
    nodeCount: 20,
    bounds: [7, 3, 4],
    bloomIntensity: 0.5,
    // The node network reads well in a roughly-square frame (hero/aside) but
    // this variant sits in a short, wide band (the homepage stats section),
    // where its vertical spread mostly falls outside the visible frame and
    // only a sliver of nodes near the horizontal center-line ever show. The
    // aurora backdrop alone still fills the band; the network doesn't add
    // anything there, so it's off for this variant specifically.
    showNetwork: false,
  },
};

/**
 * Renders `LogoMark` only when `visibility` allows it for the canvas's
 * current CSS pixel width — checked against the canvas's own rendered size
 * (`useThree().size`) rather than a separate `window.matchMedia` query, so
 * it tracks the actual responsive layout (including a resized/split desktop
 * window) instead of a second, possibly-inconsistent source of truth.
 */
function ResponsiveLogoMark({
  visibility,
  ...logoProps
}: { visibility: LogoVisibility } & ComponentProps<typeof LogoMark>) {
  const width = useThree((state) => state.size.width);

  if (visibility === 'never') return null;
  if (visibility === 'desktop-only' && width < DESKTOP_BREAKPOINT_PX) return null;

  return <LogoMark {...logoProps} />;
}

/**
 * The real R3F tree. Loaded only via `vote-scene.tsx`'s dynamic import
 * (`ssr: false`) — everything here assumes a browser + WebGL2, which is
 * exactly what that wrapper has already confirmed before this ever mounts.
 */
export function VoteSceneCanvas({
  variant,
  pointerRef,
  initialQuality,
  reducedMotion,
  onReady,
}: VoteSceneCanvasProps) {
  const [quality, setQuality] = useState(initialQuality);
  const config = VARIANT_CONFIG[variant];

  const dpr = useMemo((): [number, number] => (quality === 'high' ? [1, 2] : [1, 1.4]), [quality]);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ position: config.cameraPosition, fov: config.fov }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      style={{ pointerEvents: 'none' }}
      onCreated={() => {
        // Wait two animation frames past context creation: `onCreated` fires
        // once the renderer/scene exist, but before the render loop's first
        // real pass has necessarily painted this frame's actual colors.
        // Two nested rAFs is the standard way to guarantee "the browser has
        // completed at least one full paint" before treating the canvas as
        // safe to reveal.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => onReady?.());
        });
      }}
    >
      {/* Never ratchets quality back up mid-session — recovering from one
          slow frame only to tank again a second later reads as flicker. */}
      <PerformanceMonitor onDecline={() => setQuality('low')} />

      <color attach="background" args={['#0a1f42']} />
      <fog attach="fog" args={['#0a1f42', 9, 20]} />

      <SceneLighting quality={quality} />
      <AuroraBackdrop quality={quality} />

      {config.showNetwork && (
        <ChainNetwork
          count={config.nodeCount}
          bounds={config.bounds}
          compact={variant === 'ambient'}
        />
      )}

      <ResponsiveLogoMark
        visibility={config.logoVisibility}
        pointerRef={pointerRef}
        quality={quality}
        scale={config.logoScale}
        position={config.logoPosition}
        pointerFocus={config.logoPointerFocus}
      />

      {!reducedMotion && (
        <EffectComposer multisampling={0}>
          <Bloom
            luminanceThreshold={0.18}
            luminanceSmoothing={0.85}
            intensity={config.bloomIntensity}
            mipmapBlur
            radius={0.7}
          />
          <Vignette
            eskil={false}
            offset={0.18}
            darkness={0.6}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
      )}

      <Preload all />
    </Canvas>
  );
}

'use client';

import { Float, MeshTransmissionMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { createCatgirlFaceGeometry } from '@/lib/three/catgirl-face-geometry';
import { CATGIRL_SCENE_COLORS } from '@/lib/three/catgirl-scene-theme';
import { createLogoMarkGeometry } from '@/lib/three/logo-geometry';
import type { CatgirlImage } from '@/types/catgirl';

import type { PointerRef } from './pointer-parallax';

const NAVY = '#13294f';
const BLUE = '#008acf';
const BLUE_LIGHT = '#5fc4f5';
const GLASS_WHITE = '#f4f8ff';

const MAX_PHOTO_LONG_SIDE = 2.5;
const PHOTO_MAT_MARGIN = 0.16;
const PHOTO_GLOW_MARGIN = 0.62;

/**
 * How long we wait, after entering catgirl mode with no photo yet, before
 * revealing the procedural cat-face fallback at all. The photo fetch is
 * usually well inside this window, so the badge goes straight from the
 * checkmark to the real photo with nothing in between — the fallback face
 * never has a chance to pop in only to be swapped out moments later (the
 * "flicker" this delay exists to avoid). A slow connection or a failed
 * fetch still gets the fallback once this elapses, so the badge is never
 * left empty for long.
 */
const FALLBACK_REVEAL_DELAY_MS = 400;
/**
 * Damping speed (see `THREE.MathUtils.damp`) shared by the fallback-mark
 * and photo-card reveal below, so whichever transition happens — checkmark
 * to fallback, fallback to photo, or checkmark straight to photo — reads as
 * one smooth dissolve rather than two independently-timed pieces.
 */
const REVEAL_DAMP_SPEED = 7;

function computePhotoPlaneSize(
  width: number | undefined,
  height: number | undefined,
): [number, number] {
  const aspect = width && height && height > 0 ? width / height : 1;
  return aspect >= 1
    ? [MAX_PHOTO_LONG_SIDE, MAX_PHOTO_LONG_SIDE / aspect]
    : [MAX_PHOTO_LONG_SIDE * aspect, MAX_PHOTO_LONG_SIDE];
}

function useCatgirlTexture(url: string | null): THREE.Texture | null {
  const [result, setResult] = useState<{ url: string; texture: THREE.Texture } | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      url,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = THREE.ClampToEdgeWrapping;
        loaded.wrapT = THREE.ClampToEdgeWrapping;
        setResult({ url, texture: loaded });
      },
      undefined,
      () => {},
    );

    return () => {
      cancelled = true;
    };
  }, [url]);

  return result?.url === url ? result.texture : null;
}

interface Satellite {
  phase: number;
  radiusX: number;
  radiusY: number;
  radiusZ: number;
  size: number;
}

function createSatellites(count: number): Satellite[] {
  return Array.from({ length: count }, (_, i) => ({
    phase: (i / count) * Math.PI * 2,
    radiusX: 2.15 + (i % 3) * 0.18,
    radiusY: 0.55 + (i % 2) * 0.25,
    radiusZ: 2.35 + ((i + 1) % 3) * 0.15,
    size: 0.028 + (i % 3) * 0.008,
  }));
}

interface LogoMarkProps {
  pointerRef: PointerRef;
  /** Adaptive quality: `high` gets real glass transmission, `low` gets an equally polished but cheaper opaque material. */
  quality: 'high' | 'low';
  scale?: number;
  /** World-space offset — lets the mark sit off-center (e.g. shifted right, clear of a left-aligned text column) without moving the camera or the rest of the scene. */
  position?: [number, number, number];
  /**
   * Where the mark sits in the same normalized [-1, 1] space `pointerRef`
   * is tracked in, used only for the hover-proximity glow. Kept separate
   * from `position` (a 3D world offset) because deriving one from the other
   * needs the camera's exact projection; it's simpler and just as accurate
   * to state directly where the mark ends up on screen.
   */
  pointerFocus?: { x: number; y: number };
  catgirl?: boolean;
  catgirlImage?: CatgirlImage | null;
}

/**
 * The Vote OSS mark, rebuilt as real 3D geometry (see `logo-geometry.ts`),
 * normally set inside a frosted white glass disc — the same "icon in a soft
 * translucent badge" language as `opengraph-image.tsx`. The glass and the
 * tick move together as a single rigid badge (an earlier version spun the
 * tick independently inside a still frame, which read as broken rather than
 * intentional), given two coordinated layers of motion:
 *  - a pointer-driven tilt on the whole badge, damped so it trails the
 *    cursor like a physical object rather than snapping to it,
 *  - a "hover charge": emissive glow, glass opacity/clearcoat and scale all
 *    ease toward a lit-up state when the pointer is near, and back down
 *    when it isn't — the "effects on hover" the mark is designed around.
 *
 * In catgirl mode the mark becomes a floating photo card showing a real
 * image claimed from the same pool `<CatgirlGallery>` draws from
 * elsewhere on the page (see `useCatgirlImage`) — sized from the image's own
 * true aspect ratio (`computePhotoPlaneSize`) rather than cropped to a fixed
 * shape, so nothing about the artwork is ever cut off. A thin white mat plus
 * a soft glow in the image's own dominant color (see `colors.main` in
 * `nekosia-client.ts`) frames it instead of the round glass disc — a
 * circular puck sized for the small line mark doesn't fit a full-size
 * rectangular photo — and the whole card tilts slightly toward the pointer
 * independently of the badge's own tilt (see the `photoTilt` group below)
 * for a little extra life. A detailed "anime style" face is an
 * illustration, not something swept tube geometry can produce the way the
 * checkmark mark itself is built, so this uses real art instead of
 * approximating one.
 *
 * While that photo is loading (or if it fails — CORS/network), the mark
 * falls back to `createCatgirlFaceGeometry`'s simple procedural mark inside
 * the glass disc, like the checkmark, so the badge is never left empty —
 * but only once `FALLBACK_REVEAL_DELAY_MS` has passed with still no photo.
 * Before that it just... waits, because a fetch that resolves inside the
 * window (the common case) would otherwise flash the fallback face for a
 * fraction of a second only to replace it with the photo moments later,
 * which reads as a flicker rather than a deliberate loading state. The
 * fallback mark and the photo card are both always mounted once catgirl
 * mode is on; `fallbackReveal`/`photoReveal` (see `useFrame`) scale and
 * fade each one in or out, so every transition — checkmark to fallback,
 * fallback to photo, or checkmark straight to photo — is a brief dissolve
 * instead of an instant swap.
 *
 * The canvas this renders into is `pointer-events: none` (see
 * `vote-scene-canvas.tsx`) so the mark never steals clicks meant for the
 * headline/buttons stacked on top of it — which also means real DOM
 * pointer-over events never reach it. "Hover" is therefore proximity-based:
 * distance from the pointer (tracked independently in `pointer-parallax.tsx`)
 * to the mark's on-screen center, which works regardless of what's stacked
 * on top of the canvas.
 */
export function LogoMark({
  pointerRef,
  quality,
  scale = 1,
  position = [0, 0, 0],
  pointerFocus = { x: 0, y: 0 },
  catgirl = false,
  catgirlImage = null,
}: LogoMarkProps) {
  const markColors = catgirl
    ? CATGIRL_SCENE_COLORS.logoMark
    : { navy: NAVY, blue: BLUE, blueLight: BLUE_LIGHT, glassWhite: GLASS_WHITE };

  const photoTexture = useCatgirlTexture(catgirl ? (catgirlImage?.url ?? null) : null);
  const showPhoto = catgirl && photoTexture !== null;

  // See `FALLBACK_REVEAL_DELAY_MS` above: don't let the procedural fallback
  // mark reveal itself until the photo has had a real chance to beat it
  // there. A plain ref rather than state — `useFrame` below already reads
  // it every frame, so there's nothing for a re-render to accomplish here,
  // and setting it needs no cleanup the way a `setTimeout` would. `null`
  // means "not waiting" (catgirl is off, or the photo already showed up);
  // resetting it whenever either of those is true means a quick toggle
  // off/on starts the wait over cleanly rather than reusing a stale one.
  const fallbackDeadline = useRef<number | null>(null);
  useEffect(() => {
    fallbackDeadline.current =
      !catgirl || showPhoto ? null : performance.now() + FALLBACK_REVEAL_DELAY_MS;
  }, [catgirl, showPhoto]);

  const geometry = useMemo(
    () =>
      catgirl
        ? createCatgirlFaceGeometry({
            radius: 1,
            tubeThickness: 0.145,
            ringSegments: 220,
            radialSegments: 22,
          })
        : createLogoMarkGeometry({
            radius: 1,
            tubeThickness: 0.145,
            ringSegments: 220,
            radialSegments: 22,
          }),
    [catgirl],
  );
  const [photoWidth, photoHeight] = useMemo(
    () => computePhotoPlaneSize(catgirlImage?.width, catgirlImage?.height),
    [catgirlImage?.width, catgirlImage?.height],
  );
  const photoGeometry = useMemo(
    () => new THREE.PlaneGeometry(photoWidth, photoHeight),
    [photoWidth, photoHeight],
  );
  const photoMatGeometry = useMemo(
    () => new THREE.PlaneGeometry(photoWidth + PHOTO_MAT_MARGIN, photoHeight + PHOTO_MAT_MARGIN),
    [photoWidth, photoHeight],
  );
  const photoGlowGeometry = useMemo(
    () => new THREE.PlaneGeometry(photoWidth + PHOTO_GLOW_MARGIN, photoHeight + PHOTO_GLOW_MARGIN),
    [photoWidth, photoHeight],
  );
  // A shallow puck rather than a flat disc, so it reads as real glass with
  // a visible edge/rim under lighting rather than a paper-thin card.
  const glassGeometry = useMemo(
    () => new THREE.CylinderGeometry(1.58, 1.58, 0.22, 72, 1, false),
    [],
  );
  const satellites = useMemo(() => createSatellites(7), []);

  const tiltGroup = useRef<THREE.Group>(null);
  const fallbackGroup = useRef<THREE.Group>(null);
  const photoTilt = useRef<THREE.Group>(null);
  const glassRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const photoGlowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const photoMatMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const photoImageMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const satelliteRefs = useRef<(THREE.Mesh | null)[]>([]);

  const charge = useRef(0);
  // Crossfade blend factors, each 0 (hidden) to 1 (fully shown) — see the
  // big doc comment above. `fallbackReveal` starts at 1 so the default,
  // non-catgirl checkmark needs no reveal animation of its own; only
  // entering/leaving catgirl mode ever moves it away from that.
  const fallbackReveal = useRef(1);
  const photoReveal = useRef(0);

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 1 / 30);
    const pointer = pointerRef.current;

    // Proximity-based "hover": how close the pointer is to the mark's
    // on-screen position (`pointerFocus`), in the same normalized [-1, 1]
    // space the pointer itself is tracked in.
    const dx = pointer.x - pointerFocus.x;
    const dy = pointer.y - pointerFocus.y;
    const proximity = 1 - Math.min(1, Math.hypot(dx, dy) / 0.55);
    charge.current = THREE.MathUtils.damp(charge.current, proximity, 4, clampedDelta);

    // Crossfade targets: outside catgirl mode the fallback (checkmark) is
    // always fully shown; inside it, exactly one of "fallback" or "photo"
    // is the target at any moment, per the doc comment above.
    const fallbackAllowed =
      fallbackDeadline.current !== null && performance.now() >= fallbackDeadline.current;
    const fallbackTarget = catgirl ? (showPhoto ? 0 : fallbackAllowed ? 1 : 0) : 1;
    fallbackReveal.current = THREE.MathUtils.damp(
      fallbackReveal.current,
      fallbackTarget,
      REVEAL_DAMP_SPEED,
      clampedDelta,
    );
    photoReveal.current = THREE.MathUtils.damp(
      photoReveal.current,
      showPhoto ? 1 : 0,
      REVEAL_DAMP_SPEED,
      clampedDelta,
    );

    if (fallbackGroup.current) {
      fallbackGroup.current.scale.setScalar(fallbackReveal.current);
    }

    if (tiltGroup.current) {
      const targetX = pointer.y * 0.22;
      const targetY = pointer.x * 0.16;
      tiltGroup.current.rotation.x = THREE.MathUtils.damp(
        tiltGroup.current.rotation.x,
        targetX,
        3.5,
        clampedDelta,
      );
      tiltGroup.current.rotation.y = THREE.MathUtils.damp(
        tiltGroup.current.rotation.y,
        targetY,
        3.5,
        clampedDelta,
      );
      const targetScale = 1 + charge.current * 0.06;
      const s = THREE.MathUtils.damp(tiltGroup.current.scale.x, targetScale, 4, clampedDelta);
      tiltGroup.current.scale.setScalar(s);
    }

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.35 + charge.current * 1.1;
    }

    if (glassRef.current) {
      const glassMat = glassRef.current.material as THREE.MeshPhysicalMaterial;
      glassMat.opacity = 0.5 + charge.current * 0.14;
      glassMat.clearcoat = 0.45 + charge.current * 0.3;
    }

    if (photoTilt.current) {
      const liveliness = 0.35 + charge.current * 0.65;
      const targetPhotoX = -pointer.y * 0.3 * liveliness;
      const targetPhotoY = pointer.x * 0.4 * liveliness;
      photoTilt.current.rotation.x = THREE.MathUtils.damp(
        photoTilt.current.rotation.x,
        targetPhotoX,
        3,
        clampedDelta,
      );
      photoTilt.current.rotation.y = THREE.MathUtils.damp(
        photoTilt.current.rotation.y,
        targetPhotoY,
        3,
        clampedDelta,
      );
      // Scale up from a slightly-smaller starting point rather than a bare
      // 0 → a subtle "settle in" alongside the opacity fade below, instead
      // of the card visibly growing from a single point.
      photoTilt.current.scale.setScalar(THREE.MathUtils.lerp(0.88, 1, photoReveal.current));
    }
    if (photoGlowMaterialRef.current) {
      photoGlowMaterialRef.current.opacity = 0.25 * photoReveal.current;
    }
    if (photoMatMaterialRef.current) {
      photoMatMaterialRef.current.opacity = 0.92 * photoReveal.current;
    }
    if (photoImageMaterialRef.current) {
      photoImageMaterialRef.current.opacity = photoReveal.current;
    }

    // Orbiting satellite nodes: small verified-ballot markers circling the
    // mark on a tilted ellipse.
    const t = state.clock.elapsedTime;
    satellites.forEach((satellite, i) => {
      const ref = satelliteRefs.current[i];
      if (!ref) return;
      const speed = 0.16 + i * 0.015;
      const angle = t * speed + satellite.phase;
      const wobble = 1 + charge.current * 0.15;
      ref.position.set(
        Math.cos(angle) * satellite.radiusX * wobble,
        Math.sin(angle * 1.3 + satellite.phase) * satellite.radiusY,
        Math.sin(angle) * satellite.radiusZ * wobble,
      );
      const s = satellite.size * (1 + charge.current * 0.4);
      ref.scale.setScalar(s);
    });
  });

  return (
    <group position={position}>
      <Float
        speed={1.4}
        rotationIntensity={0.25}
        floatIntensity={0.6}
        floatingRange={[-0.12, 0.12]}
      >
        <group ref={tiltGroup} scale={scale}>
          {/* Glass disc + fallback/checkmark mark, together: always
              mounted (unlike the old hard `!showPhoto` conditional) so
              `fallbackReveal` can shrink them away smoothly instead of
              having React unmount them the instant a photo texture lands.
              A circular puck behind a much larger rectangular photo would
              read as a mismatched leftover shape behind it, so once fully
              revealed the photo's own mat + glow (below) are what actually
              frame it — this group is scaled to (near enough) zero by then,
              not just hidden behind it. */}
          <group ref={fallbackGroup}>
            <mesh
              ref={glassRef}
              geometry={glassGeometry}
              position={[0, 0, -0.25]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <meshPhysicalMaterial
                color={markColors.glassWhite}
                transparent
                opacity={0.5}
                roughness={0.5}
                metalness={0}
                clearcoat={0.45}
                clearcoatRoughness={0.28}
                envMapIntensity={1}
                side={THREE.DoubleSide}
              />
            </mesh>

            <mesh geometry={geometry} castShadow={false} receiveShadow={false}>
              {quality === 'high' ? (
                <MeshTransmissionMaterial
                  color={markColors.blue}
                  thickness={0.55}
                  roughness={0.12}
                  transmission={0.94}
                  ior={1.35}
                  chromaticAberration={0.035}
                  anisotropy={0.15}
                  distortion={0.08}
                  distortionScale={0.2}
                  temporalDistortion={0.03}
                  clearcoat={1}
                  clearcoatRoughness={0.1}
                  envMapIntensity={1.6}
                  resolution={256}
                  samples={6}
                />
              ) : (
                <meshPhysicalMaterial
                  ref={materialRef}
                  color={markColors.navy}
                  metalness={0.62}
                  roughness={0.22}
                  clearcoat={1}
                  clearcoatRoughness={0.14}
                  envMapIntensity={1.5}
                  emissive={markColors.blue}
                  emissiveIntensity={0.35}
                  reflectivity={0.9}
                />
              )}
            </mesh>
          </group>

          {/* Photo card: mounted as soon as a texture exists, faded/scaled
              in via `photoReveal` rather than appearing on the same frame
              its texture resolves. Kept mounted (at reveal 0) even if
              catgirl mode is later switched off, so toggling out fades the
              photo away too instead of popping it out. */}
          {photoTexture && (
            <group ref={photoTilt}>
              {/* `toneMapped` left at its default `true` on all three of
                  these (unlike the satellites/fallback mark, which are
                  small emissive accents meant to glow) — an un-tonemapped
                  material reads as much brighter to the scene's Bloom pass
                  (see `vote-scene-canvas.tsx`, `luminanceThreshold={0.18}`),
                  which washed out a full-frame photo to overexposed white
                  well before it would visibly affect a small accent glint. */}
              <mesh geometry={photoGlowGeometry} position={[0, 0, -0.1]}>
                <meshBasicMaterial
                  ref={photoGlowMaterialRef}
                  color={catgirlImage?.color ?? markColors.blue}
                  transparent
                  opacity={0}
                />
              </mesh>
              <mesh geometry={photoMatGeometry} position={[0, 0, -0.02]}>
                <meshBasicMaterial
                  ref={photoMatMaterialRef}
                  color="#ffffff"
                  transparent
                  opacity={0}
                />
              </mesh>
              <mesh geometry={photoGeometry} position={[0, 0, 0.02]}>
                <meshBasicMaterial ref={photoImageMaterialRef} map={photoTexture} transparent />
              </mesh>
            </group>
          )}

          {satellites.map((satellite, i) => (
            <mesh
              key={i}
              ref={(el) => {
                satelliteRefs.current[i] = el;
              }}
              scale={satellite.size}
            >
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={markColors.blueLight}
                emissive={markColors.blueLight}
                emissiveIntensity={1.4}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      </Float>
    </group>
  );
}

'use client';

import { Float, MeshTransmissionMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { createLogoMarkGeometry } from '@/lib/three/logo-geometry';

import type { PointerRef } from './pointer-parallax';

const MARK_COLORS = {
  navy: '#13294f',
  blue: '#008acf',
  blueLight: '#5fc4f5',
  glassWhite: '#f4f8ff',
};

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
}

/** The glass checkmark badge follows the pointer and glows on proximity. */
export function LogoMark({
  pointerRef,
  quality,
  scale = 1,
  position = [0, 0, 0],
  pointerFocus = { x: 0, y: 0 },
}: LogoMarkProps) {
  const markColors = MARK_COLORS;
  const geometry = useMemo(
    () =>
      createLogoMarkGeometry({
        radius: 1,
        tubeThickness: 0.145,
        ringSegments: 220,
        radialSegments: 22,
      }),
    [],
  );
  // A shallow puck rather than a flat disc, so it reads as real glass with
  // a visible edge/rim under lighting rather than a paper-thin card.
  const glassGeometry = useMemo(
    () => new THREE.CylinderGeometry(1.58, 1.58, 0.22, 72, 1, false),
    [],
  );
  const satellites = useMemo(() => createSatellites(7), []);

  const tiltGroup = useRef<THREE.Group>(null);
  const glassRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const satelliteRefs = useRef<(THREE.Mesh | null)[]>([]);
  const charge = useRef(0);

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

    // Orbiting satellite nodes: small verified-ballot markers circling the
    // mark on a tilted ellipse.
    const t = state.clock.elapsedTime;
    satellites.forEach((satellite, i) => {
      const ref = satelliteRefs.current[i];
      if (!ref) {
        return;
      }
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
          <group>
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
